from app.models.schedules import LinesAllResponse, LineSummary, Variant, LineScheduleResponse, LineScheduleTrip, LineRouteStop
from app.utils.gtfs_departures import StationDayIndex
import csv
import io
import zipfile


def published_line_catalog(payload: bytes):
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        if archive.getinfo("routes.txt").file_size > 1_000_000:
            raise ValueError("Route catalog too large")
        catalog = {}
        with archive.open("routes.txt") as file:
            for route in csv.DictReader(io.TextIOWrapper(file, encoding="utf-8-sig")):
                if route["route_type"] not in {"2", "3"}: continue
                code = route["route_short_name"].strip().upper()
                if code == "GT": code = "KI"
                catalog.setdefault(code, LineSummary(code=code, name=route["route_long_name"],
                    vehicle_types=["Train" if route["route_type"] == "2" else "Bus"]))
        return list(catalog.values())


def day_trips(index: StationDayIndex):
    unique = {}
    for visits in index.visits.values():
        for trip, _ in visits:
            first = trip["stops"][0].time
            if first and first[:10].replace("-", "") == index.date:
                key = (trip["number"], trip["service_date"], trip["line_code"], first)
                unique.setdefault(key, trip)
    return sorted(unique.values(), key=lambda trip: trip["stops"][0].time)


def timetable_lines(index: StationDayIndex):
    lines = {}
    for trip in day_trips(index):
        code = trip["line_code"]
        line = lines.setdefault(code, LineSummary(code=code, name=trip["line_name"],
            vehicle_types=["Train" if trip["service_type"] == "T" else "Bus"]))
        if trip["direction"] not in line.directions:
            line.directions.append(trip["direction"])
        if not any(variant.code == trip["variant"] and variant.direction == trip["direction"] and variant.display == trip["display"] for variant in line.variants):
            line.variants.append(Variant(code=trip["variant"], direction=trip["direction"], display=trip["display"]))
    return LinesAllResponse(date=index.date, lines=sorted(lines.values(), key=lambda line: (line.vehicle_types[0] != "Train", line.code)))


def line_timetable(index: StationDayIndex, code: str, direction: str):
    code = "KI" if code.upper() == "GT" else code.upper()
    trips = [trip for trip in day_trips(index) if trip["line_code"] == code and trip["direction"] == direction]
    if not trips:
        raise KeyError(code)
    return LineScheduleResponse(date=index.date, line_code=code, direction=direction, vehicle_type=trips[0]["service_type"],
        trips=[LineScheduleTrip(number=trip["number"], display=trip["display"], service_date=trip["service_date"],
            stops=[LineRouteStop(code=stop.code, order=stop.order, time=stop.time, name=index.names.get(stop.code)) for stop in trip["stops"]]) for trip in trips])
