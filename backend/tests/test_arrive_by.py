import os
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone

os.environ["CACHE_BACKEND"] = "memory"
os.environ["METROLINX_API_KEY"] = "test-key"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.routes import journeys


def trip(number, departure, duration, transfers=0):
    return {"orderTime": departure, "durationMinutes": duration, "transfers": transfers,
            "lines": [{"tripNumber": number, "headSign": "Union", "lineDisplay": "KI",
                       "transitTypeName": "RAIL", "fromStopCode": "KI", "toStopCode": "UN", "stops": []}]}


class ArriveByTests(unittest.TestCase):
    def search(self, fixture, date="20261013", time="0900", maximum=10, now=None):
        async def timetable(_from, _to, service_date):
            return fixture.get(service_date, {"trips": []})
        with patch.object(journeys.official_client, "get_timetable", new_callable=AsyncMock, side_effect=timetable) as fetch, \
                patch.object(journeys.client, "get_journey", new_callable=AsyncMock) as legacy, \
                patch("app.utils.official_journeys.datetime", wraps=datetime) as clock:
            clock.now.return_value = now or datetime(2026, 10, 11, 12, tzinfo=timezone.utc)
            response = TestClient(app).get(f"/api/journeys/KI/UN/{date}/{time}?search_mode=arrive_by&max_journeys={maximum}")
            legacy.assert_not_awaited()
        return response, fetch

    def test_filters_before_limiting_and_sorts_latest_departure_first(self):
        response, fetch = self.search({"20261013": {"trips": [
            trip("early", "2026-10-13T06:00:00", 60),
            trip("late-arrival", "2026-10-13T08:30:00", 61),
            trip("latest", "2026-10-13T08:15:00", 45),
            trip("longer", "2026-10-13T07:15:00", 100, 1),
        ]}}, maximum=2)
        self.assertEqual(response.status_code, 200)
        options = response.json()["journeys"]
        self.assertEqual([j["trips"][0]["number"] for j in options], ["latest", "longer"])
        self.assertEqual(options[0]["end_time"], "2026-10-13 09:00:00")
        self.assertEqual(options[1]["transfer_count"], 1)
        self.assertEqual(fetch.await_count, 2)

    def test_overnight_departure_but_not_trips_that_finished_yesterday(self):
        response, _ = self.search({
            "20261012": {"trips": [trip("overnight", "2026-10-12T23:30:00", 60),
                                     trip("old", "2026-10-12T22:00:00", 60)]},
            "20261013": {"trips": [trip("too-late", "2026-10-13T00:20:00", 60)]},
        }, time="0030")
        self.assertEqual(response.status_code, 200)
        options = response.json()["journeys"]
        self.assertEqual(len(options), 1)
        self.assertEqual(options[0]["start_time"], "2026-10-12 23:30:00")
        self.assertEqual(options[0]["end_time"], "2026-10-13 00:30:00")
        self.assertEqual(response.json()["date"], "20261013")

    def test_previous_day_lookup_crosses_year_boundary(self):
        response, fetch = self.search({}, date="20270101")
        self.assertEqual(response.status_code, 200)
        self.assertEqual({call.args[2] for call in fetch.await_args_list}, {"20270101", "20261231"})

    def test_deduplicates_and_prefers_earlier_arrival_at_same_departure(self):
        short = trip("short", "2026-10-13T08:00:00", 30)
        response, _ = self.search({"20261013": {"trips": [
            trip("long", "2026-10-13T08:00:00", 60), short, short,
        ]}})
        self.assertEqual([j["trips"][0]["number"] for j in response.json()["journeys"]], ["short", "long"])

    def test_empty_results_are_successful(self):
        response, _ = self.search({})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["journeys"], [])

    def test_failed_or_malformed_timetable_does_not_use_forward_only_fallback(self):
        for failure in [httpx.ReadTimeout("test"), {"trips": [{"bad": "shape"}]}]:
            with self.subTest(failure=failure):
                kwargs = {"side_effect": failure} if isinstance(failure, Exception) else {"return_value": failure}
                with patch.object(journeys.official_client, "get_timetable", new_callable=AsyncMock, **kwargs), \
                        patch.object(journeys.client, "get_journey", new_callable=AsyncMock) as legacy:
                    response = TestClient(app).get("/api/journeys/KI/UN/20261013/0900?search_mode=arrive_by")
                self.assertEqual(response.status_code, 503)
                self.assertIn("Try Depart at", response.json()["detail"])
                legacy.assert_not_awaited()

    def test_invalid_search_mode_is_rejected_before_fetching(self):
        with patch.object(journeys.official_client, "get_timetable", new_callable=AsyncMock) as fetch:
            response = TestClient(app).get("/api/journeys/KI/UN/20261013/0900?search_mode=invalid")
        self.assertEqual(response.status_code, 422)
        fetch.assert_not_awaited()

    def test_departures_before_current_toronto_time_are_excluded(self):
        response, _ = self.search({"20261013": {"trips": [
            trip("left", "2026-10-13T08:00:00", 40),
            trip("now", "2026-10-13T08:10:00", 40),
            trip("future", "2026-10-13T08:15:00", 45),
        ]}}, now=datetime(2026, 10, 13, 12, 10, tzinfo=timezone.utc))
        self.assertEqual([j["trips"][0]["number"] for j in response.json()["journeys"]], ["future", "now"])

    def test_arrival_window_is_inclusive_and_applied_before_limit(self):
        response, _ = self.search({"20261013": {"trips": [
            trip("hours-early", "2026-10-13T05:00:00", 60),
            trip("too-early", "2026-10-13T07:30:00", 29),
            trip("boundary", "2026-10-13T07:30:00", 30),
            trip("deadline", "2026-10-13T08:15:00", 45),
            trip("late", "2026-10-13T08:20:00", 71),
            trip("after-boundary", "2026-10-13T08:30:00", 60),
        ]}})
        self.assertEqual([j["trips"][0]["number"] for j in response.json()["journeys"]], ["after-boundary", "deadline", "boundary"])

    def test_window_can_cross_midnight(self):
        response, _ = self.search({"20261012": {"trips": [
            trip("window", "2026-10-12T23:20:00", 30),
            trip("too-early", "2026-10-12T23:00:00", 14),
        ]}}, time="0015")
        self.assertEqual([j["trips"][0]["number"] for j in response.json()["journeys"]], ["window"])

    def test_after_target_window_reads_next_day_when_needed(self):
        response, fetch = self.search({"20261014": {"trips": [
            trip("next-day", "2026-10-14T00:00:00", 20),
            trip("too-late", "2026-10-14T00:00:00", 21),
        ]}}, time="2350")
        self.assertEqual([j["trips"][0]["number"] for j in response.json()["journeys"]], ["next-day"])
        self.assertEqual({call.args[2] for call in fetch.await_args_list}, {"20261012", "20261013", "20261014"})


if __name__ == "__main__":
    unittest.main()
