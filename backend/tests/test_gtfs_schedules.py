import os
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

os.environ["CACHE_BACKEND"] = "memory"
os.environ["METROLINX_API_KEY"] = "test-key"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app.main import app
from app.routes import network_map
from app.utils.gtfs_departures import build_station_day
from app.utils.gtfs_schedules import timetable_lines, line_timetable, published_line_catalog
from test_station_departures import feed


class GtfsScheduleTests(unittest.TestCase):
    def setUp(self):
        self.index = build_station_day(feed(), "20261012")

    def test_catalog_contains_buses_and_trains_with_actual_directions(self):
        lines = timetable_lines(self.index)
        bus = next(line for line in lines.lines if line.code == "30")
        self.assertEqual(bus.vehicle_types, ["Bus"])
        self.assertEqual(bus.directions, ["0"])
        self.assertEqual(next(line for line in lines.lines if line.code == "KI").vehicle_types, ["Train"])

    def test_bus_timetable_has_ordered_stops_and_service_date(self):
        timetable = line_timetable(self.index, "30", "0")
        self.assertEqual(timetable.vehicle_type, "B")
        self.assertEqual(timetable.trips[0].number, "30001")
        self.assertEqual([stop.code for stop in timetable.trips[0].stops], ["02186", "UN"])
        self.assertEqual(timetable.trips[0].service_date, "20261012")

    def test_rail_alias_and_calendar_removals_are_respected(self):
        timetable = line_timetable(self.index, "GT", "0")
        self.assertEqual(timetable.line_code, "KI")
        self.assertEqual([trip.number for trip in timetable.trips if trip.number == "3826"], ["3826"])
        removed = timetable_lines(build_station_day(feed(True), "20261012"))
        self.assertNotIn("30", [line.code for line in removed.lines])

    def test_new_endpoints_preserve_typed_bus_responses(self):
        with patch.object(network_map.client, "get_timetable_lines", new_callable=AsyncMock, return_value=timetable_lines(self.index)), \
                patch.object(network_map.client, "get_line_timetable", new_callable=AsyncMock, return_value=line_timetable(self.index, "30", "0")):
            catalog = TestClient(app).get("/api/map/schedules/lines?schedule_date=2026-10-12")
            schedule = TestClient(app).get("/api/map/schedules/lines/30/0?schedule_date=20261012")
        self.assertEqual(catalog.status_code, 200)
        self.assertTrue(any("Bus" in line["vehicle_types"] for line in catalog.json()["lines"]))
        self.assertEqual(schedule.status_code, 200)
        self.assertEqual(schedule.json()["vehicle_type"], "B")
        self.assertEqual(TestClient(app).get("/api/map/schedules/lines?schedule_date=20260230").status_code, 422)

    def test_published_bus_names_are_available_even_when_service_is_removed(self):
        catalog = published_line_catalog(feed(True))
        bus = next(line for line in catalog if line.code == "30")
        self.assertEqual(bus.name, "Kitchener bus")
        self.assertEqual(bus.vehicle_types, ["Bus"])
        with patch.object(network_map.client, "get_line_catalog", new_callable=AsyncMock, return_value=catalog):
            response = TestClient(app).get("/api/map/lines")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(any(line["code"] == "30" for line in response.json()))


if __name__ == "__main__": unittest.main()
