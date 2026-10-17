import csv
import io
import os
from pathlib import Path
import sys
import unittest
import zipfile
from datetime import datetime
from unittest.mock import AsyncMock, patch

os.environ["CACHE_BACKEND"] = "memory"
os.environ["METROLINX_API_KEY"] = "test-key"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app.main import app
from app.clients.transit_gtfs import TransitGtfsClient
from app.utils.gtfs_departures import build_station_day, ScheduleDateUnavailable
from app.utils.gtfs_map import parse_gtfs_map
from app.utils.gtfs_schedules import timetable_lines
from app.utils import up_express, up_journeys
from app.models.journeys import JourneyTrip, JourneyStop
from app.models.journeys import JourneyResponse
from app.models.network_map import NetworkMap
from app.routes import journeys, stops, alerts


def up_feed():
    files = {
        "feed_info.txt": [["feed_version", "feed_start_date", "feed_end_date"], ["up-test", "20261001", "20261130"]],
        "routes.txt": [["route_id", "route_short_name", "route_long_name", "route_type", "route_color"], ["UP", "UP", "UP Express", "2", "0075D2"]],
        "stops.txt": [["stop_id", "stop_name", "stop_lat", "stop_lon"], ["UN", "UP Express Union Station", "43.644", "-79.383"], ["WE", "Weston GO/UP", "43.7", "-79.51"], ["PA", "UP Express Pearson Airport", "43.68", "-79.61"]],
        "trips.txt": [["trip_id", "route_id", "service_id", "direction_id", "shape_id", "trip_headsign"], ["20261017-4001", "UP", "day", "0", "out", "Pearson Airport"], ["20261017-4002", "UP", "day", "1", "back", "Union Station"]],
        "calendar_dates.txt": [["service_id", "date", "exception_type"], ["day", "20261017", "1"]],
        "stop_times.txt": [["trip_id", "stop_id", "stop_sequence", "arrival_time", "departure_time"],
            ["20261017-4001", "UN", "1", "12:00:00", "12:00:00"], ["20261017-4001", "WE", "2", "12:16:00", "12:16:00"], ["20261017-4001", "PA", "3", "12:28:00", "12:28:00"],
            ["20261017-4002", "PA", "1", "13:00:00", "13:00:00"], ["20261017-4002", "WE", "2", "13:12:00", "13:12:00"], ["20261017-4002", "UN", "3", "13:28:00", "13:28:00"]],
        "shapes.txt": [["shape_id", "shape_pt_sequence", "shape_pt_lat", "shape_pt_lon"], ["out", "1", "43.644", "-79.383"], ["out", "2", "43.68", "-79.61"], ["back", "1", "43.68", "-79.61"], ["back", "2", "43.644", "-79.383"]],
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for filename, rows in files.items():
            text = io.StringIO()
            csv.writer(text).writerows(rows)
            archive.writestr(filename, text.getvalue())
    return output.getvalue()


NOW = datetime(2026, 10, 17, 12, 0, tzinfo=up_express.TORONTO)


def update_feed(relationship="SCHEDULED", age=0):
    stamp = int(NOW.timestamp()) - age
    return {"header": {"timestamp": stamp}, "entity": [{"id": "u1", "trip_update": {
        "trip": {"trip_id": "20261017-4001", "start_date": "20261017", "schedule_relationship": relationship},
        "timestamp": stamp,
        "stop_time_update": [{"stop_id": "PA", "departure": {"time": int(NOW.timestamp()) + 30 * 60, "delay": 120}}]
    }}]}


class UpAdapterTests(unittest.TestCase):
    def setUp(self):
        self.index = build_station_day(up_feed(), "20261017", "UP-")

    def test_feed_has_separate_line_shared_station_ids_and_namespaced_trips(self):
        network = parse_gtfs_map(up_feed())
        self.assertEqual(network.lines[0].code, "UP")
        self.assertEqual(network.lines[0].color, "#0075D2")
        self.assertEqual(self.index.board("UN").departures[0].trip_number, "UP-4001")
        self.assertEqual(self.index.board("UN").departures[0].destination, "UP Express Pearson Airport")
        self.assertEqual(timetable_lines(self.index).lines[0].directions, ["0", "1"])

    def test_terminal_departure_prediction_is_displayed_as_arrival(self):
        record = self.index.visits["UN"][0][0]
        update = up_express.updates(update_feed(), NOW)[0]
        report = up_express.trip_report(record, update)
        self.assertEqual(report.stops[-1].arrival_scheduled, "2026-10-17 12:28:00")
        self.assertEqual(report.stops[-1].arrival_computed, "2026-10-17 12:30:00")
        self.assertIsNone(report.stops[-1].departure_computed)
        self.assertIsNone(report.stops[0].departure_computed)

    def test_stale_and_deleted_updates_cannot_be_applied(self):
        self.assertEqual(up_express.updates(update_feed(age=301), NOW), [])
        raw = update_feed()
        raw["entity"][0]["is_deleted"] = True
        self.assertEqual(up_express.updates(raw, NOW), [])

    def test_cancellation_and_skipped_stop_are_distinct(self):
        record = self.index.visits["UN"][0][0]
        update = up_express.updates(update_feed("CANCELED"), NOW)[0]
        self.assertEqual(up_express.trip_report(record, update).status, "Cancelled")
        update["trip"]["schedule_relationship"] = "SCHEDULED"
        update["stop_time_update"][0]["schedule_relationship"] = "SKIPPED"
        report = up_express.trip_report(record, update)
        self.assertIsNone(report.status)
        self.assertEqual(report.stops[-1].status, "Skipped")

    def test_alerts_use_english_filter_active_periods_and_scope_to_up(self):
        alert = {"active_period": [{"start": int(NOW.timestamp()) - 10, "end": int(NOW.timestamp()) + 10}],
            "informed_entity": [{"stop_id": "WE", "trip": None}],
            "header_text": {"translation": [{"language": "fr", "text": "FR"}, {"language": "en", "text": "Elevator unavailable"}]},
            "description_text": {"translation": [{"language": "en", "text": "Use the accessible entrance."}]}}
        raw = {"entity": [{"id": "1", "alert": alert}, {"id": "2", "alert": alert, "is_deleted": True}]}
        messages = up_express.up_alerts(raw, NOW)
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0].affected_lines, ["UP"])
        self.assertEqual(messages[0].affected_stops, ["WE"])
        self.assertEqual(messages[0].title, "Elevator unavailable")
        alert["active_period"][0]["end"] = int(NOW.timestamp()) - 1
        self.assertEqual(up_express.up_alerts(raw, NOW), [])


class UpIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_live_delay_and_cancellation_keep_the_up_service_date(self):
        raw = update_feed()
        cancelled = update_feed("CANCELED")["entity"][0]
        cancelled["trip_update"]["trip"]["trip_id"] = "20261017-4002"
        raw["entity"].append(cancelled)
        with patch.object(up_express.client, "get_up_trip_updates", AsyncMock(return_value=raw)), patch.object(up_express, "fresh", return_value=True):
            trips, exceptions = await up_express.up_live_data()
        self.assertEqual(trips[0].delay_status, "delayed")
        self.assertEqual(trips[0].delay_minutes, 2)
        self.assertEqual(trips[0].service_date, "20261017")
        self.assertEqual(exceptions.trips[0].trip_number, "UP-4002")
        self.assertEqual(exceptions.cancelled_trips, 1)

    async def test_previous_service_day_overnight_trip_details_remain_available(self):
        source = zipfile.ZipFile(io.BytesIO(up_feed()))
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as destination:
            for name in source.namelist():
                text = source.read(name).decode("utf-8")
                if name == "stop_times.txt":
                    text = text.replace("12:00:00", "24:00:00").replace("12:16:00", "24:16:00").replace("12:28:00", "24:28:00")
                destination.writestr(name, text)
        payload = output.getvalue()
        async def day(date):
            return build_station_day(payload, date, "UP-")
        with patch.object(up_express.up_gtfs, "_get_day", side_effect=day), patch.object(up_express.client, "get_up_trip_updates", AsyncMock(return_value={})):
            details = await up_express.up_trip_schedule("UP-4001", "20261017")
        self.assertEqual(details.date, "20261017")
        self.assertEqual(details.trips[0].stops[0].departure_scheduled, "2026-10-18 00:00:00")

    async def test_merged_board_retains_both_operators_at_shared_station(self):
        up = build_station_day(up_feed(), "20261017", "UP-")
        go = build_station_day(up_feed(), "20261017")
        for visits in go.visits.values():
            for record, _ in visits:
                record["line_code"] = "KI"
        client = TransitGtfsClient()
        with patch.object(client.go, "_get_day", AsyncMock(return_value=go)), patch.object(client.up, "_get_day", AsyncMock(return_value=up)):
            board = await client.get_station_departures("UN", "20261017")
        self.assertEqual({item.line_code for item in board.departures}, {"KI", "UP"})
        self.assertEqual({item.trip_number for item in board.departures}, {"4001", "UP-4001"})

    async def test_up_keeps_its_longer_calendar_when_go_feed_has_expired(self):
        up = build_station_day(up_feed(), "20261017", "UP-")
        client = TransitGtfsClient()
        with patch.object(client.go, "_get_day", AsyncMock(side_effect=ScheduleDateUnavailable)), patch.object(client.up, "_get_day", AsyncMock(return_value=up)):
            board = await client.get_station_departures("PA", "20261017")
        self.assertEqual(board.departures[0].trip_number, "UP-4002")

    async def test_map_merges_shared_stations_instead_of_duplicating_them(self):
        network = parse_gtfs_map(up_feed())
        go = NetworkMap(stops=[network.stops[0].model_copy(update={"name": "Union GO", "line_codes": ["KI"]})], lines=[])
        client = TransitGtfsClient()
        with patch.object(client.go, "get_network", AsyncMock(return_value=go)), patch.object(client.up, "get_network", AsyncMock(return_value=network)):
            merged = await client.get_network()
        self.assertEqual(len(merged.stops), 3)
        self.assertEqual(merged.stops[0].line_codes, ["KI", "UP"])
        self.assertEqual(go.stops[0].line_codes, ["KI"])

    async def test_direct_airport_trip_and_go_connection_require_transfer_time(self):
        index = build_station_day(up_feed(), "20261017", "UP-")
        async def go_options(origin, destination, date):
            if destination != "WE":
                return []
            leg = JourneyTrip(number="3826", display="Union", line="KI", direction="E", vehicle_type="T",
                depart_from_code=origin, destination_stop_code="WE", stops=[
                    JourneyStop(code=origin, time="2026-10-17 11:00:00"),
                    JourneyStop(code="WE", time="2026-10-17 12:08:00")])
            return [up_journeys.journey([leg])]
        with patch.object(up_journeys.up_gtfs, "_get_day", AsyncMock(return_value=index)):
            direct = await up_journeys.plan_up_journeys("UN", "PA", "20261017", go_options)
            connected = await up_journeys.plan_up_journeys("KI", "PA", "20261017", go_options)
        self.assertEqual(direct[0].transfer_count, 0)
        self.assertEqual([trip.line for trip in connected[0].trips], ["KI", "UP"])
        self.assertEqual(connected[0].end_time, "2026-10-17 12:28:00")
        index.visits["UN"][0][0]["stops"][1].time = "2026-10-17 12:10:00"
        with patch.object(up_journeys.up_gtfs, "_get_day", AsyncMock(return_value=index)):
            self.assertEqual(await up_journeys.plan_up_journeys("KI", "PA", "20261017", go_options), [])

    async def test_connections_anchor_go_clock_times_and_clip_the_full_stop_pattern(self):
        leg = JourneyTrip(number="3604", display="Union", line="KI", direction="E", vehicle_type="T",
            depart_from_code="BE", destination_stop_code="WE", stops=[
                JourneyStop(code="KI", time="10:00"), JourneyStop(code="BE", time="11:30"),
                JourneyStop(code="WE", time="11:48"), JourneyStop(code="UN", time="12:10")])
        option = up_journeys.journey([leg.model_copy(update={"stops": [JourneyStop(code="BE", time="2026-10-17 11:30:00"), JourneyStop(code="WE", time="2026-10-17 11:48:00")]})])
        option.trips = [leg]
        result = up_journeys.dated_go_journey(option)
        self.assertEqual([stop.code for stop in result.trips[0].stops], ["BE", "WE"])
        self.assertEqual(result.trips[0].stops[0].time, "2026-10-17 11:30:00")
        self.assertEqual(leg.stops[0].time, "10:00")


class UpEndpointTests(unittest.TestCase):
    def test_go_airport_bus_options_are_preserved_alongside_up(self):
        index = build_station_day(up_feed(), "20261017", "UP-")
        bus = JourneyTrip(number="40000", display="Pearson", line="40", direction="E", vehicle_type="B",
            depart_from_code="UN", destination_stop_code="PA", stops=[JourneyStop(code="UN", time="2026-10-17 12:05:00"), JourneyStop(code="PA", time="2026-10-17 13:00:00")])
        go = JourneyResponse(from_stop="UN", to_stop="PA", date="20261017", start_time="1150", journeys=[up_journeys.journey([bus])])
        with patch.object(up_journeys.up_gtfs, "_get_day", AsyncMock(return_value=index)), patch.object(journeys, "_fetch_go_journeys", AsyncMock(return_value=go)):
            response = TestClient(app).get("/api/journeys/UN/PA/20261017/1150")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["trips"][0]["line"] for item in response.json()["journeys"]], ["UP", "40"])

    def test_airport_search_uses_up_timetable_and_keeps_departure_order(self):
        index = build_station_day(up_feed(), "20261017", "UP-")
        empty_go = JourneyResponse(from_stop="UN", to_stop="PA", date="20261017", start_time="1150", journeys=[])
        with patch.object(up_journeys.up_gtfs, "_get_day", AsyncMock(return_value=index)), patch.object(journeys, "_fetch_go_journeys", AsyncMock(return_value=empty_go)):
            response = TestClient(app).get("/api/journeys/UN/PA/20261017/1150")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["journeys"][0]["trips"][0]["number"], "UP-4001")

    def test_up_alert_failure_is_explicit_without_hiding_go_alerts(self):
        with patch.object(alerts.client, "get_service_alerts", AsyncMock(return_value={})), patch.object(alerts.client, "get_information_alerts", AsyncMock(return_value={})), patch.object(alerts.client, "get_up_alerts", AsyncMock(side_effect=ValueError)):
            response = TestClient(app).get("/api/alerts/all")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["unavailable_lines"], ["UP"])

    def test_airport_station_details_do_not_use_go_only_endpoint(self):
        network = parse_gtfs_map(up_feed())
        with patch.object(stops.up_gtfs, "get_network", AsyncMock(return_value=network)), patch.object(stops.client, "get_stop_details", AsyncMock()) as go:
            response = TestClient(app).get("/api/stops/PA/details")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["stop_name"], "UP Express Pearson Airport")
        go.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
