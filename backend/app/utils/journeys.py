from datetime import datetime
from typing import Optional

from app.models.journeys import JourneyService, JourneyTrip


def _timestamp(value: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def _boarding_service(leg: JourneyTrip) -> tuple:
    return (leg.number, leg.line, leg.direction, leg.vehicle_type, leg.depart_from_code)


def _same_line_train_changes(journey: JourneyService) -> bool:
    """Identify changes between trains on the same line at the same station."""
    if journey.transfer_count <= 0 or len(journey.trips) < 2:
        return False
    first = journey.trips[0]
    if not first.line or not first.direction:
        return False
    return (
        all(
            leg.vehicle_type.upper() in {"T", "TRAIN"}
            and leg.line == first.line
            and leg.direction == first.direction
            for leg in journey.trips
        )
        and all(
            previous.destination_stop_code
            and previous.destination_stop_code == following.depart_from_code
            for previous, following in zip(journey.trips, journey.trips[1:])
        )
    )


def remove_unnecessary_transfers(journeys: list[JourneyService]) -> list[JourneyService]:
    """Remove slower same-line train changes when staying aboard is better.

    Mixed train/bus trips, different lines, and changes between different stations
    remain available regardless of duration. Trip numbers, boarding times, and
    destinations must match a direct option; faster connections are retained.
    """
    direct_trips = [
        journey for journey in journeys
        if journey.transfer_count == 0 and len(journey.trips) == 1
    ]
    kept = []

    for journey in journeys:
        redundant = False
        if _same_line_train_changes(journey):
            first_leg = journey.trips[0]
            departure = _timestamp(journey.start_time)
            arrival = _timestamp(journey.end_time)
            identity_known = all((
                first_leg.number, first_leg.line, first_leg.vehicle_type,
                first_leg.depart_from_code, journey.trips[-1].destination_stop_code,
            ))
            if identity_known and departure is not None and arrival is not None:
                for direct in direct_trips:
                    direct_leg = direct.trips[0]
                    direct_departure = _timestamp(direct.start_time)
                    direct_arrival = _timestamp(direct.end_time)
                    if (
                        _boarding_service(direct_leg) == _boarding_service(first_leg)
                        and direct_departure == departure
                        and direct_leg.destination_stop_code == journey.trips[-1].destination_stop_code
                        and direct_arrival is not None
                        and (direct_arrival.tzinfo is None) == (arrival.tzinfo is None)
                        and direct_arrival <= arrival
                    ):
                        redundant = True
                        break
        if not redundant:
            kept.append(journey)

    return kept
