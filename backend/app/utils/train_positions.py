"""Recent reported GO rail coordinates; no timetable-derived positions."""
import math
import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.models.network_map import MapTrainPosition, MapTrainPositions

MAX_POSITION_AGE = 180
GO_LINES = {"LW", "LE", "KI", "BR", "RH", "ST", "MI"}
TORONTO = ZoneInfo("America/Toronto")


def _timestamp(value, now):
    if isinstance(value, bool):
        return None
    try:
        result = datetime.fromtimestamp(int(value), timezone.utc)
        return result if -60 <= (now - result).total_seconds() <= MAX_POSITION_AGE else None
    except (TypeError, ValueError, OverflowError, OSError):
        return None


def transform_train_positions(raw, now=None) -> MapTrainPositions:
    now = now or datetime.now(timezone.utc)
    if not isinstance(raw, dict) or not isinstance(raw.get("entity"), list):
        raise ValueError("Invalid vehicle position feed")
    header = raw.get("header") or {}
    stamp = _timestamp(header.get("timestamp"), now)
    if not stamp:
        return MapTrainPositions(available=False)
    trains = {}
    for entity in raw["entity"]:
        try:
            if entity.get("is_deleted"):
                continue
            vehicle = entity.get("vehicle") or {}
            trip = vehicle.get("trip") or {}
            match = re.fullmatch(r"(\d{8})-([A-Za-z]+)-([A-Za-z0-9]+)", trip.get("trip_id", ""))
            if not match or trip.get("schedule_relationship") in {"CANCELED", 3, "DELETED", 7}:
                continue
            date, code, number = match.groups()
            code = "KI" if code.upper() == "GT" else code.upper()
            if code not in GO_LINES or (trip.get("start_date") and trip["start_date"] != date):
                continue
            service_day = datetime.strptime(date, "%Y%m%d").replace(tzinfo=TORONTO)
            if trip.get("start_time"):
                hours, minutes, seconds = map(int, trip["start_time"].split(":"))
                if not (0 <= hours <= 47 and 0 <= minutes <= 59 and 0 <= seconds <= 59):
                    continue
                if service_day + timedelta(hours=hours, minutes=minutes, seconds=seconds) > now:
                    continue
            if (now.astimezone(TORONTO).date() - service_day.date()).days not in {0, 1}:
                continue
            observed = _timestamp(vehicle.get("timestamp"), now)
            position = vehicle.get("position") or {}
            latitude, longitude = position.get("latitude"), position.get("longitude")
            invalid_coordinates = any(
                isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value)
                for value in (latitude, longitude)
            )
            if not observed or invalid_coordinates:
                continue
            # Reject missing/placeholder coordinates and positions outside GO's region.
            if not (42 <= latitude <= 46 and -83 <= longitude <= -76):
                continue
            identifier = f"{date}:{code}:{number}"
            status = vehicle.get("current_status")
            status_name = {
                "STOPPED_AT": "stopped", 1: "stopped",
                "INCOMING_AT": "approaching", 0: "approaching",
                "IN_TRANSIT_TO": "moving", 2: "moving",
            }.get(status, "reported")
            item = MapTrainPosition(
                id=identifier, trip_number=number, service_date=date, line_code=code,
                display=str((vehicle.get("vehicle") or {}).get("label") or f"{code} train {number}"),
                latitude=latitude, longitude=longitude, updated_at=observed.isoformat(),
                stop_code=vehicle.get("stop_id") or None,
                status=status_name,
            )
            if identifier not in trains or item.updated_at > trains[identifier].updated_at:
                trains[identifier] = item
        except (AttributeError, TypeError, ValueError):
            continue  # One malformed entity must not discard the rest of the feed.
    return MapTrainPositions(available=True, updated_at=stamp.isoformat(), trains=list(trains.values()))
