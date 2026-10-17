"""UP direct journeys and timed GO/UP connections at shared stations."""
import asyncio
from datetime import datetime, timedelta

from app.clients.transit_gtfs import UP_STOPS, up_gtfs
from app.models.journeys import JourneyService, JourneyTrip
from app.utils.gtfs_schedules import day_trips
from app.utils.gtfs_departures import ScheduleDateUnavailable


def dated_go_journey(option):
    """Clip official stop patterns to each leg and anchor clock times to its day."""
    result = option.model_copy(deep=True)
    previous = datetime.fromisoformat(option.start_time)
    for leg in result.trips:
        start = next((i for i, stop in enumerate(leg.stops) if stop.code == leg.depart_from_code), -1)
        end = next((i for i, stop in enumerate(leg.stops) if i >= start and stop.code == leg.destination_stop_code), -1)
        if start < 0 or end <= start:
            raise ValueError("Missing GO connection stop times")
        leg.stops = leg.stops[start:end + 1]
        for stop in leg.stops:
            if not stop.time:
                continue
            if len(stop.time) > 10:
                timestamp = datetime.fromisoformat(stop.time)
            else:
                hours, minutes = map(int, stop.time.split(":")[:2])
                timestamp = previous.replace(hour=0, minute=0, second=0) + timedelta(hours=hours, minutes=minutes)
                if timestamp < previous:
                    timestamp += timedelta(days=1)
            stop.time = timestamp.strftime("%Y-%m-%d %H:%M:%S")
            previous = timestamp
    return result


def journey(legs):
    start = legs[0].stops[0].time
    end = legs[-1].stops[-1].time
    seconds = int((datetime.fromisoformat(end) - datetime.fromisoformat(start)).total_seconds())
    return JourneyService(trip_hash="|".join(f"{leg.number}:{leg.depart_from_code}:{leg.destination_stop_code}:{leg.stops[0].time}" for leg in legs),
        start_time=start, end_time=end, duration=f"{seconds // 3600:02}:{seconds // 60 % 60:02}:00",
        transfer_count=len(legs) - 1, trips=legs)


async def direct_up_journeys(from_stop, to_stop, dates):
    options = []
    for date in dates:
        try:
            index = await up_gtfs._get_day(date)
        except ScheduleDateUnavailable:
            continue
        for record in day_trips(index):
            stops = record["stops"]
            start = next((i for i, stop in enumerate(stops) if stop.code == from_stop), -1)
            end = next((i for i, stop in enumerate(stops) if stop.code == to_stop), -1)
            if start < 0 or end <= start:
                continue
            leg = JourneyTrip(number=record["number"], display=record["display"], line="UP",
                direction=record["direction"], vehicle_type="T", depart_from_code=from_stop,
                destination_stop_code=to_stop, service_date=record["service_date"], stops=stops[start:end + 1])
            options.append(journey([leg]))
    return options


async def plan_up_journeys(from_stop, to_stop, date, fetch_go, arrive_by=False):
    if from_stop not in UP_STOPS and to_stop not in UP_STOPS:
        return []
    day = datetime.strptime(date, "%Y%m%d")
    dates = [date]
    if arrive_by:
        dates = [(day + timedelta(days=offset)).strftime("%Y%m%d") for offset in [-1, 0, 1]]
    if from_stop in UP_STOPS and to_stop in UP_STOPS:
        return await direct_up_journeys(from_stop, to_stop, dates)
    if "PA" not in {from_stop, to_stop}:
        return []

    airport_bound = to_stop == "PA"
    async def connect(interchange):
        up_from, up_to = (interchange, "PA") if airport_bound else ("PA", interchange)
        up_options = await direct_up_journeys(up_from, up_to, dates)
        go_from, go_to = (from_stop, interchange) if airport_bound else (interchange, to_stop)
        go_lists = await asyncio.gather(*(fetch_go(go_from, go_to, date) for date in dates))
        go_options = []
        for options in go_lists:
            for option in options:
                try:
                    go_options.append(dated_go_journey(option))
                except (ValueError, TypeError):
                    continue
        connected = []
        minimum = 12 if interchange == "UN" else 8
        for go in go_options:
            for up in up_options:
                first, second = (go, up) if airport_bound else (up, go)
                gap = (datetime.fromisoformat(second.start_time) - datetime.fromisoformat(first.end_time)).total_seconds() / 60
                if minimum <= gap <= 60:
                    connected.append(journey(first.trips + second.trips))
        return connected

    lists = await asyncio.gather(*(connect(stop) for stop in ["WE", "MD", "BL", "UN"]), return_exceptions=True)
    if all(isinstance(result, BaseException) for result in lists):
        raise ValueError("GO/UP connections unavailable")
    # Keep the fastest interchange for each pair of services, rather than four
    # variations of the same ride through the shared Kitchener corridor.
    unique = {}
    for result in lists:
        if isinstance(result, BaseException):
            continue
        for option in result:
            key = (tuple(leg.number for leg in option.trips), option.start_time[:10])
            previous = unique.get(key)
            if previous is None or (option.end_time, -datetime.fromisoformat(option.start_time).timestamp()) < (previous.end_time, -datetime.fromisoformat(previous.start_time).timestamp()):
                unique[key] = option
    return list(unique.values())
