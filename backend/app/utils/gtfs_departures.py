import csv
import io
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.models.journeys import JourneyStop
from app.models.stops import StationDeparture, StationDepartures


class ScheduleDateUnavailable(ValueError):
    pass


def _time(day, value):
    if not value:
        return None
    hours, minutes, seconds = map(int, value.split(":"))
    return day + timedelta(hours=hours, minutes=minutes, seconds=seconds)


def _stop_time(day, stop, terminal):
    value = stop.get("arrival_time") if terminal else stop.get("departure_time")
    timestamp = _time(day, value or stop.get("arrival_time") or stop.get("departure_time"))
    return timestamp.strftime("%Y-%m-%d %H:%M:%S") if timestamp else None


@dataclass
class StationDayIndex:
    date: str
    names: dict
    visits: dict

    def board(self, code: str) -> StationDepartures:
        if code not in self.names:
            raise KeyError(code)
        departures = []
        for trip, index in self.visits.get(code, []):
            timeline = trip["stops"]
            departures.append(StationDeparture(
                trip_number=trip["number"], service_date=trip["service_date"],
                line_code=trip["line_code"], line_name=trip["line_name"], service_type=trip["service_type"],
                destination=self.names.get(timeline[-1].code, timeline[-1].code),
                scheduled_departure_time=timeline[index].time, stops=timeline[index:],
            ))
        departures.sort(key=lambda departure: (departure.scheduled_departure_time, departure.line_code, departure.trip_number))
        return StationDepartures(stop_code=code, date=self.date, departures=departures)


def build_station_day(payload: bytes, date: str) -> StationDayIndex:
    """Index boarding departures on a calendar day, including previous-day 24+ times."""
    day = datetime.strptime(date, "%Y%m%d")
    previous = day - timedelta(days=1)
    end = day + timedelta(days=1)
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        if sum(info.file_size for info in archive.infolist()) > 250_000_000:
            raise ValueError("GTFS archive too large")

        def rows(name):
            with archive.open(name) as file:
                yield from csv.DictReader(io.TextIOWrapper(file, encoding="utf-8-sig"))

        info = next(rows("feed_info.txt"), {}) if "feed_info.txt" in archive.namelist() else {}
        if (info.get("feed_start_date") and date < info["feed_start_date"]) or (info.get("feed_end_date") and date > info["feed_end_date"]):
            raise ScheduleDateUnavailable()
        dates = [day, previous]
        calendars = list(rows("calendar.txt")) if "calendar.txt" in archive.namelist() else []
        exceptions = list(rows("calendar_dates.txt")) if "calendar_dates.txt" in archive.namelist() else []
        active_days = defaultdict(list)
        for service_day in dates:
            date_code = service_day.strftime("%Y%m%d")
            weekday = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][service_day.weekday()]
            active = {row["service_id"] for row in calendars if row["start_date"] <= date_code <= row["end_date"] and row[weekday] == "1"}
            for row in exceptions:
                if row["date"] == date_code:
                    if row["exception_type"] == "1": active.add(row["service_id"])
                    elif row["exception_type"] == "2": active.discard(row["service_id"])
            for service in active: active_days[service].append(service_day)
        names = {row["stop_id"]: row["stop_name"] for row in rows("stops.txt")}
        routes = {row["route_id"]: row for row in rows("routes.txt")}
        trips = {row["trip_id"]: row for row in rows("trips.txt") if row["service_id"] in active_days}
        timings = defaultdict(list)
        for row in rows("stop_times.txt"):
            if row["trip_id"] in trips:
                timings[row["trip_id"]].append(row)
        visits = defaultdict(list)
        for trip_id, trip in trips.items():
            route = routes[trip["route_id"]]
            if route["route_type"] not in {"2", "3"}: continue
            sequence = sorted(timings[trip_id], key=lambda stop: int(stop["stop_sequence"]))
            if len(sequence) < 2: continue
            code = route["route_short_name"].strip().upper()
            if code == "GT": code = "KI"
            for service_day in active_days[trip["service_id"]]:
                timeline = [JourneyStop(code=stop["stop_id"], order=index + 1,
                    time=_stop_time(service_day, stop, index == len(sequence) - 1))
                    for index, stop in enumerate(sequence)]
                record = {"number": trip.get("trip_short_name", "").strip() or trip_id.rsplit("-", 1)[-1],
                    "service_date": service_day.strftime("%Y%m%d"), "line_code": code,
                    "line_name": route["route_long_name"], "service_type": "T" if route["route_type"] == "2" else "B", "stops": timeline}
                record.update(direction=trip.get("direction_id") or "0",
                              display=trip.get("trip_headsign") or names.get(timeline[-1].code, timeline[-1].code),
                              variant=trip.get("route_variant") or code)
                for index, stop in enumerate(sequence[:-1]):
                    if stop.get("pickup_type") == "1": continue
                    if not timeline[index].time: continue
                    departure = datetime.fromisoformat(timeline[index].time)
                    if day <= departure < end:
                        visits[stop["stop_id"]].append((record, index))
        return StationDayIndex(date, names, visits)
