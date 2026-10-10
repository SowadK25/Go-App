import os
from pathlib import Path
import sys
import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

os.environ["CACHE_BACKEND"] = "memory"
os.environ["METROLINX_API_KEY"] = "test-secret"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.routes import stops, service, schedules
from app.utils.utils import normalize_date, normalize_time, toronto_today


class MobileFoundationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=False)

    def test_health_contract(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "cache_backend": "memory", "cache": "ok"})

    def test_invalid_journey_dates_and_times_are_422(self):
        for date, time in [("bad", "1200"), ("20260230", "1200"), ("20260101", "2460"), ("20260101", "12xx00")]:
            with self.subTest(date=date, time=time):
                response = self.client.get(f"/api/journeys/UN/OS/{date}/{time}")
                self.assertEqual(response.status_code, 422)

    def test_invalid_fare_date_is_not_swallowed(self):
        self.assertEqual(self.client.get("/api/fares/UN/OS?operational_day=20261301").status_code, 422)

    def test_all_schedule_endpoints_validate_dates(self):
        for path in ["/api/schedules/lines", "/api/schedules/lines/LW/E", "/api/schedules/lines/LW/E/stops", "/api/schedules/trips/123"]:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path + "?schedule_date=20260230").status_code, 422)

    def test_accepted_formats(self):
        self.assertEqual(normalize_date("2028-02-29"), "20280229")
        self.assertEqual(normalize_time("23:59"), "2359")

    def test_toronto_date_across_utc_midnight_and_dst(self):
        for month, hour in [(1, 4), (7, 3)]:
            instant = datetime(2026, month, 2, hour, tzinfo=timezone.utc)
            with patch("app.utils.utils.datetime") as clock:
                clock.now.side_effect = lambda zone: instant.astimezone(zone)
                self.assertEqual(toronto_today(), f"2026{month:02d}01")

    def test_schedule_normalizes_supplied_date_and_uses_toronto_default(self):
        with patch.object(schedules.client, "get_lines_all", new_callable=AsyncMock, return_value={}) as fetch:
            self.assertEqual(self.client.get("/api/schedules/lines?schedule_date=2026-10-10").status_code, 200)
            fetch.assert_awaited_with("20261010")
            with patch("app.routes.schedules.toronto_today", return_value="20261009"):
                self.assertEqual(self.client.get("/api/schedules/lines").status_code, 200)
                fetch.assert_awaited_with("20261009")

    def test_upstream_credentials_never_reach_client(self):
        request = httpx.Request("GET", "https://example.com?key=test-secret")
        for status, expected in [(401, 502), (429, 503), (500, 502), (404, 404)]:
            error = httpx.HTTPStatusError("Sensitive URL: " + str(request.url), request=request, response=httpx.Response(status, request=request))
            with patch.object(stops.client, "get_stops_all", new_callable=AsyncMock, side_effect=error):
                response = self.client.get("/api/stops")
            self.assertEqual(response.status_code, expected)
            self.assertNotIn("test-secret", response.text)
            self.assertNotIn("example.com", response.text)

    def test_connection_timeout_and_unexpected_errors_are_safe(self):
        for error, status in [(httpx.ConnectError("key=test-secret"), 502), (httpx.ReadTimeout("key=test-secret"), 504), (ValueError("key=test-secret"), 500)]:
            with patch.object(stops.client, "get_stops_all", new_callable=AsyncMock, side_effect=error):
                response = self.client.get("/api/stops")
            self.assertEqual(response.status_code, status)
            self.assertNotIn("test-secret", response.text)

    def test_missing_filtered_trip_remains_404(self):
        with patch.object(service.client, "get_service_trains", new_callable=AsyncMock, return_value={}):
            self.assertEqual(self.client.get("/api/service/trains?trip_number=missing").status_code, 404)

    def test_stations_and_departures_contract(self):
        # Exercises the HTTP route and real transformers using upstream fixtures.
        station = {"id": "UN", "name": "Union Station", "type": "Train", "public_id": None}
        with patch.object(stops.client, "get_stops_all", new_callable=AsyncMock, return_value={"Stations": {"Station": [{"LocationCode": "UN", "LocationName": "Union Station", "LocationType": "Train"}]}}):
            response = self.client.get("/api/stops")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()[0]["id"], station["id"])
        with patch.object(stops.client, "get_stop_next_service", new_callable=AsyncMock, return_value={}):
            response = self.client.get("/api/stops/UN/next-service")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {"stop_code": "UN", "lines": []})


if __name__ == "__main__":
    unittest.main()
