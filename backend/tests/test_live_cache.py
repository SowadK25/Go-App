import os
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

os.environ["CACHE_BACKEND"] = "memory"
os.environ["METROLINX_API_KEY"] = "cache-test"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from app.clients.metrolinx import MetrolinxClient
from app.utils.cache import InMemoryCache


class LiveCacheTests(unittest.IsolatedAsyncioTestCase):
    async def test_reuses_upstream_data_until_live_cache_expires(self):
        for endpoint, lifetime in [
            ("ServiceataGlance/Trains/All", 60),
            ("ServiceataGlance/Buses/All", 60),
            ("ServiceUpdate/Exceptions/Train", 120),
            ("ServiceUpdate/Exceptions/Bus", 120),
            ("Schedule/Trip/20261010/3030", 60),
        ]:
            with self.subTest(endpoint=endpoint):
                shared = InMemoryCache()
                first, second = MetrolinxClient(), MetrolinxClient()
                first._cache = second._cache = shared
                response = httpx.Response(200, json={"snapshot": "live"}, request=httpx.Request("GET", "https://example.com"))
                with patch("app.utils.cache.time.time", return_value=1000) as clock, patch("app.clients.metrolinx.httpx.AsyncClient") as factory:
                    upstream = factory.return_value.__aenter__.return_value
                    upstream.get = AsyncMock(return_value=response)
                    await first._get(endpoint)
                    clock.return_value = 1000 + lifetime - 1
                    await second._get(endpoint)
                    self.assertEqual(upstream.get.await_count, 1)
                    clock.return_value = 1000 + lifetime + 1
                    await second._get(endpoint)
                    self.assertEqual(upstream.get.await_count, 2)
