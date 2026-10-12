import csv
import asyncio
import time
import io
import os
from pathlib import Path
import sys
import unittest
import zipfile
from unittest.mock import AsyncMock, patch

os.environ["CACHE_BACKEND"] = "memory"
os.environ["METROLINX_API_KEY"] = "test-key"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app.main import app
from app.routes import stops
from app.utils.gtfs_departures import build_station_day, ScheduleDateUnavailable
from app.clients.gtfs import GtfsClient


def feed(remove_weekday=False):
    files = {
        "feed_info.txt": [["feed_start_date", "feed_end_date"], ["20261005", "20261127"]],
        "routes.txt": [["route_id", "route_short_name", "route_long_name", "route_type"], ["train", "GT", "Kitchener", "2"], ["bus", "30", "Kitchener bus", "3"]],
        "stops.txt": [["stop_id", "stop_name"], ["KI", "Kitchener GO"], ["MO", "Mount Pleasant GO"], ["UN", "Union Station GO"], ["02186", "Kitchener GO Bus"], ["SF", "Stratford GO"]],
        "calendar.txt": [["service_id", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "start_date", "end_date"], ["weekday", "1", "1", "1", "1", "1", "0", "0", "20261005", "20261127"]],
        "calendar_dates.txt": [["service_id", "date", "exception_type"], ["night", "20261011", "1"]] + ([["weekday", "20261012", "2"]] if remove_weekday else []),
        "trips.txt": [["trip_id", "route_id", "service_id", "trip_short_name"], ["date-GT-3826", "train", "weekday", ""], ["date-GT-3959", "train", "weekday", ""], ["date-GT-inbound", "train", "weekday", ""], ["date-GT-no-pickup", "train", "weekday", ""], ["date-30-30001", "bus", "weekday", ""], ["date-GT-night", "train", "night", ""]],
        "stop_times.txt": [["trip_id", "stop_id", "stop_sequence", "arrival_time", "departure_time", "pickup_type"],
            ["date-GT-3826", "UN", "3", "17:30:00", "17:30:00", "1"],
            ["date-GT-3826", "KI", "1", "15:50:00", "15:50:00", "0"],
            ["date-GT-3826", "MO", "2", "16:20:00", "16:21:00", "0"],
            ["date-GT-3959", "KI", "1", "10:25:00", "10:25:00", "0"], ["date-GT-3959", "SF", "2", "11:20:00", "11:20:00", "1"],
            ["date-GT-inbound", "UN", "1", "12:00:00", "12:00:00", "0"], ["date-GT-inbound", "KI", "2", "13:00:00", "13:00:00", "0"],
            ["date-GT-no-pickup", "KI", "1", "14:00:00", "14:00:00", "1"], ["date-GT-no-pickup", "UN", "2", "15:00:00", "15:00:00", "1"],
            ["date-30-30001", "02186", "1", "16:00:00", "16:00:00", "0"], ["date-30-30001", "UN", "2", "17:00:00", "17:00:00", "1"],
            ["date-GT-night", "KI", "1", "24:15:00", "24:15:00", "0"], ["date-GT-night", "UN", "2", "25:00:00", "25:00:00", "1"]],
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for name, values in files.items():
            text = io.StringIO(); csv.writer(text).writerows(values)
            archive.writestr(name, text.getvalue())
    return output.getvalue()


class StationDepartureTests(unittest.TestCase):
    def test_full_day_all_destinations_sorted_and_no_arrival_only_trips(self):
        board = build_station_day(feed(), "20261012").board("KI")
        self.assertEqual([item.trip_number for item in board.departures], ["night", "3959", "3826"])
        self.assertEqual(board.departures[1].destination, "Stratford GO")
        self.assertEqual(board.departures[2].scheduled_departure_time, "2026-10-12 15:50:00")
        self.assertEqual(board.departures[2].line_code, "KI")
        self.assertEqual([stop.code for stop in board.departures[2].stops], ["KI", "MO", "UN"])

    def test_overnight_service_dates_and_calendar_exceptions(self):
        board = build_station_day(feed(True), "20261012").board("KI")
        self.assertEqual(len(board.departures), 1)
        self.assertEqual(board.departures[0].service_date, "20261011")
        self.assertEqual(board.departures[0].scheduled_departure_time, "2026-10-12 00:15:00")

    def test_bus_stop_separate_and_unknown_station_is_not_empty_service(self):
        index = build_station_day(feed(), "20261012")
        self.assertEqual(index.board("02186").departures[0].service_type, "B")
        with self.assertRaises(KeyError): index.board("unknown")
        with self.assertRaises(ScheduleDateUnavailable): build_station_day(feed(), "20261201")

    def test_endpoint_normalizes_date_and_has_no_live_dependency(self):
        async def get_board(code, date): return build_station_day(feed(), date).board(code)
        with patch.object(stops.gtfs_client, "get_station_departures", new_callable=AsyncMock, side_effect=get_board):
            response = TestClient(app).get("/api/stops/KI/departures?schedule_date=2026-10-12")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["departures"]), 3)
        self.assertEqual(TestClient(app).get("/api/stops/KI/departures?schedule_date=20260230").status_code, 422)

    def test_unpublished_dates_are_distinguished_from_provider_failure(self):
        for error, status in [(ScheduleDateUnavailable(), 404), (KeyError("unknown"), 404), (ValueError("private"), 503)]:
            with patch.object(stops.gtfs_client, "get_station_departures", new_callable=AsyncMock, side_effect=error):
                response = TestClient(app).get("/api/stops/KI/departures?schedule_date=20261012")
            self.assertEqual(response.status_code, status)
            self.assertNotIn("private", response.text)


class StationDayCacheTests(unittest.IsolatedAsyncioTestCase):
    async def test_multiple_stations_share_one_feed_and_day_parse(self):
        client = GtfsClient()
        client._payload = feed()
        client._feed_updated = time.monotonic()
        with patch("app.clients.gtfs.build_station_day", wraps=build_station_day) as parse, \
                patch("app.clients.gtfs.httpx.AsyncClient") as download:
            boards = await asyncio.gather(client.get_station_departures("KI", "20261012"), client.get_station_departures("UN", "20261012"))
        self.assertEqual(parse.call_count, 1)
        download.assert_not_called()
        self.assertEqual([board.stop_code for board in boards], ["KI", "UN"])


if __name__ == "__main__": unittest.main()
