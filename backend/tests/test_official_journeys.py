import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

os.environ["CACHE_BACKEND"] = "memory"
os.environ["METROLINX_API_KEY"] = "test-key"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.routes import journeys
from app.models.journeys import JourneyResponse
from app.utils.official_journeys import transform_timetable, select_journeys

FIXTURE = json.loads((Path(__file__).parent / "fixtures/official_kitchener.json").read_text(encoding="utf-8"))


class OfficialJourneyTests(unittest.TestCase):
    def test_includes_actual_bus_train_connection(self):
        result = transform_timetable(FIXTURE, "KI", "UN", "20261013", "0808")
        connection = next(j for j in result.journeys if j.start_time.endswith("08:13:00"))
        self.assertEqual(connection.end_time, "2026-10-13 10:15:00")
        self.assertEqual(connection.transfer_count, 1)
        self.assertEqual([leg.vehicle_type for leg in connection.trips], ["B", "T"])
        self.assertEqual(connection.trips[0].stops[-1].time, "09:33")
        self.assertEqual(connection.trips[1].stops[0].time, "09:48")

    def test_respects_requested_departure_time(self):
        result = transform_timetable(FIXTURE, "KI", "UN", "20261013", "0814")
        self.assertEqual(len(result.journeys), 1)
        self.assertTrue(result.journeys[0].start_time.endswith("08:36:00"))

    def test_deduplicates_source_options_without_losing_bus_connection(self):
        official = transform_timetable(FIXTURE, "KI", "UN", "20261013", "0808")
        official.journeys.append(official.journeys[0].model_copy(deep=True))
        selected = select_journeys(official, 10)
        self.assertEqual(len(selected), 3)
        self.assertIs(selected[0], official.journeys[0])
        self.assertEqual(selected[1].transfer_count, 1)

    def test_handles_arrival_after_midnight(self):
        data = {"trips": [{**FIXTURE["trips"][0], "orderTime": "2026-10-13T23:30:00", "durationMinutes": 99}]}
        result = transform_timetable(data, "KI", "UN", "20261013", "2300")
        self.assertEqual(result.journeys[0].end_time, "2026-10-14 01:09:00")

    def test_endpoint_uses_official_without_calling_open_data(self):
        with patch.object(journeys.client, "get_journey", new_callable=AsyncMock, side_effect=httpx.ConnectError("test")) as legacy, patch.object(journeys.official_client, "get_timetable", new_callable=AsyncMock, return_value=FIXTURE):
            response = TestClient(app).get("/api/journeys/KI/UN/20261013/0808?max_journeys=10")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["journeys"]), 3)
        legacy.assert_not_awaited()

    def test_endpoint_falls_back_when_official_source_fails(self):
        with patch.object(journeys.client, "get_journey", new_callable=AsyncMock, return_value={}), patch.object(journeys.official_client, "get_timetable", new_callable=AsyncMock, side_effect=httpx.ReadTimeout("test")):
            response = TestClient(app).get("/api/journeys/KI/UN/20261013/0808")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["journeys"], [])

    def test_empty_official_results_do_not_trigger_fallback(self):
        with patch.object(journeys.client, "get_journey", new_callable=AsyncMock) as legacy, patch.object(journeys.official_client, "get_timetable", new_callable=AsyncMock, return_value={"trips": []}):
            response = TestClient(app).get("/api/journeys/KI/UN/20261013/2359")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["journeys"], [])
        legacy.assert_not_awaited()

    def test_official_results_are_sorted_and_limited(self):
        reversed_fixture = {"trips": list(reversed(FIXTURE["trips"]))}
        with patch.object(journeys.client, "get_journey", new_callable=AsyncMock) as legacy, patch.object(journeys.official_client, "get_timetable", new_callable=AsyncMock, return_value=reversed_fixture):
            response = TestClient(app).get("/api/journeys/KI/UN/20261013/0808?max_journeys=1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["journeys"]), 1)
        self.assertEqual(response.json()["journeys"][0]["start_time"], "2026-10-13 08:08:00")
        legacy.assert_not_awaited()

    def test_malformed_official_payload_keeps_open_data_fallback(self):
        with patch.object(journeys.client, "get_journey", new_callable=AsyncMock, return_value={}), patch.object(journeys.official_client, "get_timetable", new_callable=AsyncMock, return_value={"trips": [{"bad": "shape"}]}):
            response = TestClient(app).get("/api/journeys/KI/UN/20261013/0808")
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
