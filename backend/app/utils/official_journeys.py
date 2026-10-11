from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.models.journeys import JourneyResponse, JourneyService, JourneyTrip, JourneyStop


def _at_time(day: datetime, value: str) -> datetime:
    hours, minutes = map(int, value.split(":")[:2])
    return day.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(hours=hours, minutes=minutes)


def transform_timetable(data: dict, from_stop: str, to_stop: str, date: str, start_time: str) -> JourneyResponse:
    """Convert official timetable options to the app's existing journey contract."""
    if not isinstance(data, dict) or not isinstance(data.get("trips"), list):
        raise ValueError("Invalid official timetable response")
    day = datetime.strptime(date, "%Y%m%d")
    threshold = _at_time(day, f"{start_time[:2]}:{start_time[2:]}")
    journeys = []
    for trip in data.get("trips", []):
        departure = datetime.fromisoformat(trip["orderTime"])
        # Timetable timestamps represent the local service day, not UTC.
        if departure < threshold:
            continue
        arrival = departure + timedelta(minutes=trip["durationMinutes"])
        legs = []
        for line in trip.get("lines", []):
            legs.append(JourneyTrip(
                number=str(line["tripNumber"]),
                display=line.get("headSign") or line.get("serviceLineName", ""),
                line=line["lineDisplay"],
                direction="",
                vehicle_type="T" if line["transitTypeName"] == "RAIL" else "B",
                depart_from_code=line["fromStopCode"],
                destination_stop_code=line["toStopCode"],
                stops=[JourneyStop(
                    code=stop["code"], order=index + 1, time=stop.get("time"),
                ) for index, stop in enumerate(line.get("stops", []))],
            ))
        if not legs:
            continue
        journeys.append(JourneyService(
            trip_hash="official:" + ":".join(leg.number for leg in legs),
            start_time=departure.strftime("%Y-%m-%d %H:%M:%S"),
            end_time=arrival.strftime("%Y-%m-%d %H:%M:%S"),
            duration=trip.get("duration"),
            transfer_count=trip.get("transfers", max(0, len(legs) - 1)),
            trips=legs,
        ))
    return JourneyResponse(from_stop=from_stop, to_stop=to_stop, date=date, start_time=start_time, journeys=journeys)


def select_journeys(response: JourneyResponse, maximum: int) -> list[JourneyService]:
    """Deduplicate one source's options, then sort and limit the results."""
    unique = {}
    for journey in response.journeys:
        identity = (
            journey.start_time, journey.end_time,
            tuple((leg.number, leg.vehicle_type, leg.depart_from_code, leg.destination_stop_code)
                  for leg in journey.trips),
        )
        unique.setdefault(identity, journey)
    return sorted(unique.values(), key=lambda journey: (journey.start_time, journey.end_time))[:maximum]


def select_arrive_by(journeys: list[JourneyService], date: str, time: str, maximum: int, now: datetime | None = None) -> list[JourneyService]:
    """Choose upcoming departures arriving one hour before to 30 minutes after the target."""
    deadline = _at_time(datetime.strptime(date, "%Y%m%d"), f"{time[:2]}:{time[2:]}")
    earliest = deadline - timedelta(hours=1)
    latest = deadline + timedelta(minutes=30)
    current = now if now is not None else datetime.now(ZoneInfo("America/Toronto"))
    if current.tzinfo is not None:
        current = current.astimezone(ZoneInfo("America/Toronto")).replace(tzinfo=None)
    eligible = [journey for journey in journeys
                if earliest <= datetime.fromisoformat(journey.end_time) <= latest
                and datetime.fromisoformat(journey.start_time) >= current]
    response = JourneyResponse(from_stop="", to_stop="", date=date, start_time=time, journeys=eligible)
    unique = select_journeys(response, len(eligible))
    # Stable ordering gives the earlier arrival priority for identical departure times.
    unique.sort(key=lambda journey: journey.end_time)
    return sorted(unique, key=lambda journey: journey.start_time, reverse=True)[:maximum]
