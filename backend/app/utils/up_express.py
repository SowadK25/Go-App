"""Adapt UP's GTFS realtime JSON to the app's existing transit models."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.clients.metrolinx import MetrolinxClient
from app.clients.transit_gtfs import up_gtfs
from app.models.alerts import Alert
from app.models.schedules import TripDetails, TripStopDetails, TripScheduleResponse
from app.models.service import ServiceTrip, ServiceExceptionTrip, ServiceExceptionsResponse, UnionDeparture, UnionDepartureStop
from app.models.stops import NextServiceLine
from app.utils.gtfs_schedules import day_trips

TORONTO = ZoneInfo("America/Toronto")
client = MetrolinxClient()


def local_time(epoch):
    return datetime.fromtimestamp(int(epoch), TORONTO).strftime("%Y-%m-%d %H:%M:%S") if epoch else None


def fresh(epoch, now=None):
    return bool(epoch) and -60 <= ((now or datetime.now(TORONTO)).timestamp() - int(epoch)) <= 300


def trip_number(trip):
    return "UP-" + trip.get("trip_id", "").rsplit("-", 1)[-1]


def updates(raw, now=None):
    if not isinstance(raw.get("entity"), list):
        raise ValueError("Invalid UP realtime feed")
    if not fresh(raw.get("header", {}).get("timestamp"), now):
        return []
    return [entity["trip_update"] for entity in raw["entity"]
            if not entity.get("is_deleted") and entity.get("trip_update")
            and fresh(entity["trip_update"].get("timestamp") or raw["header"].get("timestamp"), now)]


def english(value):
    translations = (value or {}).get("translation") or []
    return next((item.get("text", "") for item in translations if item.get("language", "").startswith("en")),
                translations[0].get("text", "") if translations else "")


def up_alerts(raw, now=None):
    if not isinstance(raw.get("entity"), list):
        raise ValueError("Invalid UP alert feed")
    now_epoch = (now or datetime.now(TORONTO)).timestamp()
    alerts = []
    for entity in raw["entity"]:
        alert = entity.get("alert")
        if entity.get("is_deleted") or not alert:
            continue
        periods = alert.get("active_period") or []
        if periods and not any((not p.get("start") or p["start"] <= now_epoch) and (not p.get("end") or now_epoch <= p["end"]) for p in periods):
            continue
        affected = alert.get("informed_entity") or []
        alerts.append(Alert(code="UP-" + str(entity["id"]), status="UPD", alert_type="Service",
            title=english(alert.get("header_text")), body=english(alert.get("description_text")),
            posted_at=local_time(min((p["start"] for p in periods if p.get("start")), default=None)),
            category=alert.get("effect"), affected_lines=["UP"],
            affected_stops=sorted({item["stop_id"] for item in affected if item.get("stop_id")}),
            affected_trips=sorted({trip_number(item["trip"]) for item in affected if (item.get("trip") or {}).get("trip_id")})
        ))
    return alerts


def trip_report(record, update=None, timestamp=None):
    stop_updates = {stop["stop_id"]: stop for stop in (update or {}).get("stop_time_update", [])}
    cancelled = (update or {}).get("trip", {}).get("schedule_relationship") in {"CANCELED", 3}
    stops = []
    timeline = record["stops"]
    for index, stop in enumerate(timeline):
        prediction = stop_updates.get(stop.code, {})
        arrival = prediction.get("arrival") or {}
        departure = prediction.get("departure") or {}
        terminal = index == len(timeline) - 1
        scheduled_arrival = record.get("arrivals", {}).get(stop.code)
        # UP publishes terminal predictions as departure events; display them as arrivals.
        if terminal and not arrival:
            arrival = departure
            departure = {}
        elif index > 0 and not arrival and scheduled_arrival == stop.time:
            arrival = departure
        def computed(event, scheduled=None):
            if event.get("time"):
                return local_time(event["time"])
            if event.get("delay") is not None and (scheduled or stop.time):
                return (datetime.fromisoformat(scheduled or stop.time) + timedelta(seconds=event["delay"])).strftime("%Y-%m-%d %H:%M:%S")
            return None
        skipped = prediction.get("schedule_relationship") in {"SKIPPED", 1}
        if cancelled or skipped or prediction.get("schedule_relationship") in {"NO_DATA", 2}:
            arrival, departure = {}, {}
        stops.append(TripStopDetails(code=stop.code,
            arrival_scheduled=(scheduled_arrival or stop.time) if index > 0 else None,
            departure_scheduled=stop.time if not terminal else None,
            arrival_computed=computed(arrival, scheduled_arrival), departure_computed=computed(departure),
            status="Cancelled" if cancelled else "Skipped" if skipped else None))
    return TripDetails(trip_number=record["number"], destination=record["display"],
        status="Cancelled" if cancelled else None,
        timestamp=local_time((update or {}).get("timestamp") or timestamp) if update else None, stops=stops)


async def up_trip_schedule(number, date):
    record = None
    for day in [date, (datetime.strptime(date, "%Y%m%d") + timedelta(days=1)).strftime("%Y%m%d")]:
        try:
            index = await up_gtfs._get_day(day)
        except ValueError:
            continue
        record = next((trip for visits in index.visits.values() for trip, _ in visits
                       if trip["number"] == number and trip["service_date"] == date), None)
        if record:
            break
    if record is None:
        raise KeyError(number)
    update, timestamp = None, None
    if date == datetime.now(TORONTO).strftime("%Y%m%d") or date == (datetime.now(TORONTO) - timedelta(days=1)).strftime("%Y%m%d"):
        try:
            raw = await client.get_up_trip_updates()
            timestamp = raw.get("header", {}).get("timestamp")
            update = next((item for item in updates(raw) if trip_number(item["trip"]) == number and item["trip"].get("start_date") == date), None)
        except Exception:
            pass  # Static stop times remain useful when the live feed is unavailable.
    return TripScheduleResponse(date=date, trips=[trip_report(record, update, timestamp)])


async def up_live_data():
    raw = await client.get_up_trip_updates()
    active = updates(raw)
    trips, exceptions = [], []
    for update in active:
        descriptor = update["trip"]
        number = trip_number(descriptor)
        stamp = local_time(update.get("timestamp") or raw["header"].get("timestamp"))
        if descriptor.get("schedule_relationship") in {"CANCELED", 3}:
            exceptions.append(ServiceExceptionTrip(trip_number=number, service_date=descriptor.get("start_date"), is_cancelled=True, exception_type="cancelled"))
            continue
        delays = [event["delay"] for stop in update.get("stop_time_update", [])
                  for event in [stop.get("departure") or stop.get("arrival") or {}] if event.get("delay") is not None]
        delay = delays[0] if delays else update.get("delay")
        status = None if delay is None else "delayed" if delay >= 60 else "early" if delay <= -60 else "on_time"
        trips.append(ServiceTrip(trip_number=number, service_date=descriptor.get("start_date"), line_code="UP", display="UP Express", modified_at=stamp,
            delay_seconds=delay, delay_minutes=round(delay / 60) if delay is not None else None, delay_status=status))
    return trips, ServiceExceptionsResponse(mode="train", generated_at=local_time(raw.get("header", {}).get("timestamp")),
        trips=exceptions, total_trips=len(exceptions), cancelled_trips=len(exceptions))


async def up_next_service(stop_code):
    now = datetime.now(TORONTO)
    date = now.strftime("%Y%m%d")
    index = await up_gtfs._get_day(date)
    raw = await client.get_up_trip_updates()
    reports = {(trip_number(item["trip"]), item["trip"].get("start_date")): item for item in updates(raw)}
    lines = []
    for record, position in index.visits.get(stop_code, []):
        update = reports.get((record["number"], record["service_date"]))
        report = trip_report(record, update, raw.get("header", {}).get("timestamp"))
        stop = report.stops[position]
        time = stop.departure_computed or stop.departure_scheduled
        if time < now.strftime("%Y-%m-%d %H:%M:%S") or time > (now + timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"):
            continue
        lines.append(NextServiceLine(line_code="UP", line_name="UP Express", service_type="T",
            direction_name=record["display"], trip_number=record["number"],
            scheduled_departure_time=stop.departure_scheduled, computed_departure_time=stop.departure_computed,
            departure_status=stop.status, status=report.status or "Scheduled", update_time=report.timestamp))
    return lines


async def up_union_departures():
    index = await up_gtfs._get_day(datetime.now(TORONTO).strftime("%Y%m%d"))
    names = index.names
    departures = []
    for line in await up_next_service("UN"):
        if line.status == "Cancelled":
            continue
        record = next(trip for trip, _ in index.visits["UN"] if trip["number"] == line.trip_number)
        departures.append(UnionDeparture(trip_number=line.trip_number, service="UP Express", service_type="T",
            service_date=record["service_date"], computed_departure_time=line.computed_departure_time,
            info="Check UP displays", boarding_status="wait",
            departure_datetime=line.scheduled_departure_time, departure_time=line.scheduled_departure_time[11:16],
            destination=names["PA"], stops=[UnionDepartureStop(code=stop.code, name=names[stop.code]) for stop in record["stops"]]))
    return departures
