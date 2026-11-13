import copy
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

os.environ["CACHE_BACKEND"] = "memory"
os.environ["METROLINX_API_KEY"] = "train-position-test"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app.main import app
from app.routes import network_map
from app.utils.train_positions import transform_train_positions, TORONTO

NOW = datetime(2030, 11, 12, 17, 0, tzinfo=timezone.utc)


def feed(now=NOW):
    date = now.astimezone(TORONTO).strftime("%Y%m%d")
    return {"header": {"timestamp": int(now.timestamp())}, "entity": [{
        "id": "train", "vehicle": {
            "trip": {"trip_id": f"{date}-LW-1017", "start_date": date, "start_time": "10:00:00"},
            "vehicle": {"id": "630", "label": "LW - Aldershot GO"},
            "position": {"latitude": 43.59, "longitude": -79.54},
            "timestamp": int(now.timestamp()) - 20, "current_status": "IN_TRANSIT_TO", "stop_id": "LO",
        },
    }]}


class TrainPositionTests(unittest.TestCase):
    def test_recent_report_preserves_observation_time_and_trip_identity(self):
        result = transform_train_positions(feed(), NOW)
        self.assertTrue(result.available)
        item = result.trains[0]
        self.assertEqual(item.id, "20301112:LW:1017")
        self.assertEqual(item.service_date, "20301112")
        self.assertEqual(item.trip_number, "1017")
        self.assertEqual(item.latitude, 43.59)
        self.assertEqual(item.updated_at, (NOW - timedelta(seconds=20)).isoformat())
        self.assertEqual(item.status, "moving")

    def test_stale_missing_and_future_observations_are_not_inferred(self):
        for stamp in [None, int(NOW.timestamp()) - 181, int(NOW.timestamp()) + 61, True]:
            with self.subTest(stamp=stamp):
                raw = feed()
                raw["entity"][0]["vehicle"]["timestamp"] = stamp
                self.assertEqual(transform_train_positions(raw, NOW).trains, [])

    def test_stale_feed_is_unavailable_and_fresh_empty_feed_is_empty(self):
        raw = feed()
        raw["header"]["timestamp"] -= 181
        self.assertFalse(transform_train_positions(raw, NOW).available)
        raw = feed()
        raw["entity"] = []
        result = transform_train_positions(raw, NOW)
        self.assertTrue(result.available)
        self.assertEqual(result.trains, [])

    def test_invalid_coordinates_and_unrelated_modes_are_excluded(self):
        for position in [{}, {"latitude": 0, "longitude": 0}, {"latitude": float("nan"), "longitude": -79},
                         {"latitude": True, "longitude": -79}, {"latitude": 43, "longitude": -125}]:
            raw = feed()
            raw["entity"][0]["vehicle"]["position"] = position
            self.assertEqual(transform_train_positions(raw, NOW).trains, [])
        for code in ["41", "UP", "UPX", "UNKNOWN"]:
            raw = feed()
            raw["entity"][0]["vehicle"]["trip"]["trip_id"] = f"20301112-{code}-1017"
            self.assertEqual(transform_train_positions(raw, NOW).trains, [])

    def test_not_started_deleted_and_cancelled_trains_are_excluded(self):
        changes = [
            lambda entry: entry.update(is_deleted=True),
            lambda entry: entry["vehicle"]["trip"].update(start_time="13:00:00"),
            lambda entry: entry["vehicle"]["trip"].update(schedule_relationship="CANCELED"),
            lambda entry: entry["vehicle"]["trip"].update(start_date="20301111"),
        ]
        for change in changes:
            raw = feed()
            change(raw["entity"][0])
            self.assertEqual(transform_train_positions(raw, NOW).trains, [])

    def test_kitchener_alias_and_numeric_station_status(self):
        raw = feed()
        vehicle = raw["entity"][0]["vehicle"]
        vehicle["trip"]["trip_id"] = "20301112-GT-3030"
        vehicle["current_status"] = 1
        item = transform_train_positions(raw, NOW).trains[0]
        self.assertEqual(item.line_code, "KI")
        self.assertEqual(item.status, "stopped")
        vehicle["current_status"] = 0
        self.assertEqual(transform_train_positions(raw, NOW).trains[0].status, "approaching")

    def test_previous_service_day_with_extended_hours_is_retained(self):
        now = datetime(2030, 11, 13, 6, 0, tzinfo=timezone.utc)
        raw = feed(now)
        raw["entity"][0]["vehicle"]["trip"].update(trip_id="20301112-LW-1017", start_date="20301112", start_time="24:10:00")
        self.assertEqual(transform_train_positions(raw, now).trains[0].service_date, "20301112")

    def test_duplicates_keep_latest_report_and_malformed_entities_do_not_hide_trains(self):
        raw = feed()
        old = copy.deepcopy(raw["entity"][0])
        old["vehicle"]["timestamp"] -= 30
        old["vehicle"]["position"]["latitude"] = 43.7
        raw["entity"] = [None, {"vehicle": "bad"}, old] + raw["entity"]
        result = transform_train_positions(raw, NOW)
        self.assertEqual(len(result.trains), 1)
        self.assertEqual(result.trains[0].latitude, 43.59)

    def test_route_returns_safe_failure_and_has_no_upstream_urls(self):
        with patch.object(network_map.live_client, "get_gtfs_vehicle_positions", new_callable=AsyncMock, side_effect=ValueError("private upstream URL")):
            response = TestClient(app).get("/api/map/trains")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private upstream URL", response.text)

    def test_route_returns_validated_position_contract(self):
        now = datetime.now(timezone.utc)
        raw = feed(now)
        raw["entity"][0]["vehicle"]["trip"]["start_time"] = "00:00:00"
        with patch.object(network_map.live_client, "get_gtfs_vehicle_positions", new_callable=AsyncMock, return_value=raw):
            response = TestClient(app).get("/api/map/trains")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["available"])
        self.assertEqual(response.json()["trains"][0]["trip_number"], "1017")
