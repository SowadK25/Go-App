import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

os.environ["CACHE_BACKEND"] = "memory"
os.environ["METROLINX_API_KEY"] = "rate-limit-test"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from app.main import app
from app.utils.cache import InMemoryCache


class RateLimitTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.cache = patch.object(app.state, "cache_backend", InMemoryCache())
        self.cache.start()
        self.addCleanup(self.cache.stop)
        self.limit = patch("app.main.RATE_LIMIT_PER_MIN", 2)
        self.limit.start()
        self.addCleanup(self.limit.stop)

    def client(self, ip, application=app):
        return httpx.AsyncClient(
            transport=httpx.ASGITransport(app=application, client=(ip, 50000)),
            base_url="http://test",
        )

    async def test_rotating_forged_headers_cannot_reset_direct_client_limit(self):
        async with self.client("198.51.100.10") as client:
            for number, expected in [(1, 404), (2, 404), (3, 429)]:
                response = await client.get("/api/missing", headers={
                    "X-Forwarded-For": f"203.0.113.{number}",
                    "X-Real-IP": f"203.0.113.{number}",
                    "Forwarded": f"for=203.0.113.{number}",
                })
                self.assertEqual(response.status_code, expected)
            self.assertEqual(response.json(), {"detail": "Rate limit exceeded"})
            self.assertTrue(1 <= int(response.headers["Retry-After"]) <= 60)

    async def test_separate_connection_addresses_have_separate_buckets(self):
        for ip in ["198.51.100.10", "198.51.100.11"]:
            async with self.client(ip) as client:
                for expected in [404, 404, 429]:
                    response = await client.get("/api/missing")
                    self.assertEqual(response.status_code, expected)

    async def test_trusted_proxy_uses_client_nearest_trusted_chain(self):
        proxied = ProxyHeadersMiddleware(app, trusted_hosts="10.0.0.1,10.0.0.2")
        async with self.client("10.0.0.1", proxied) as client:
            for number, expected in [(1, 404), (2, 404), (3, 429)]:
                # Attacker-supplied leftmost values must not override the actual client.
                response = await client.get("/api/missing", headers={
                    "X-Forwarded-For": f"203.0.113.{number}, 198.51.100.10, 10.0.0.2",
                })
                self.assertEqual(response.status_code, expected)
            response = await client.get("/api/missing", headers={
                "X-Forwarded-For": "198.51.100.11, 10.0.0.2",
            })
            self.assertEqual(response.status_code, 404)

    async def test_untrusted_connection_cannot_use_proxy_resolution(self):
        proxied = ProxyHeadersMiddleware(app, trusted_hosts="10.0.0.1")
        async with self.client("198.51.100.10", proxied) as client:
            for number, expected in [(1, 404), (2, 404), (3, 429)]:
                response = await client.get("/api/missing", headers={
                    "X-Forwarded-For": f"203.0.113.{number}",
                })
                self.assertEqual(response.status_code, expected)

    async def test_limit_resets_after_window_and_does_not_limit_health(self):
        async with self.client("198.51.100.10") as client:
            with patch("app.utils.cache.time.time", return_value=1000) as clock:
                for expected in [404, 404, 429]:
                    response = await client.get("/api/missing")
                    self.assertEqual(response.status_code, expected)
                self.assertEqual((await client.get("/health")).status_code, 200)
                clock.return_value = 1061
                self.assertEqual((await client.get("/api/missing")).status_code, 404)
