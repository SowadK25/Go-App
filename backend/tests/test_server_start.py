import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from serve import main


class ServerStartTests(unittest.TestCase):
    def test_railway_port_and_secure_proxy_defaults(self):
        with patch.dict(os.environ, {"PORT": "9123"}, clear=True), patch("serve.uvicorn.run") as run:
            main()
        self.assertEqual(run.call_args.kwargs["port"], 9123)
        self.assertEqual(run.call_args.kwargs["host"], "0.0.0.0")
        self.assertEqual(run.call_args.kwargs["workers"], 1)
        self.assertFalse(run.call_args.kwargs["proxy_headers"])
        self.assertEqual(run.call_args.kwargs["forwarded_allow_ips"], "")

    def test_explicit_proxy_allowlist_is_forwarded_to_uvicorn(self):
        trusted = "10.0.0.1,10.0.0.2"
        with patch.dict(os.environ, {"FORWARDED_ALLOW_IPS": trusted}, clear=True), patch("serve.uvicorn.run") as run:
            main()
        self.assertTrue(run.call_args.kwargs["proxy_headers"])
        self.assertEqual(run.call_args.kwargs["forwarded_allow_ips"], trusted)

    def test_wildcard_proxy_trust_cannot_disable_rate_limit_hardening(self):
        for trusted in ["*", "127.0.0.1, *"]:
            with self.subTest(trusted=trusted), patch.dict(os.environ, {"FORWARDED_ALLOW_IPS": trusted}), patch("serve.uvicorn.run") as run:
                with self.assertRaises(RuntimeError):
                    main()
                run.assert_not_called()
