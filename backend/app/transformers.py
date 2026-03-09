"""
Transform raw Metrolinx API responses into clean, frontend-friendly models
"""
from typing import List, Dict, Any, Optional
from app.models.stops import NextServiceLine, Stop, StopDetails, NextService
from app.models.journeys import JourneyResponse, JourneyService, JourneyTrip, JourneyStop
from app.models.alerts import Alert, ServiceException
from app.models.fares import FaresResponse, FareOption
from app.models.service import (
    ServiceAtGlanceResponse,
    ServiceTrip,
    UnionDeparture,
    UnionDepartureStop,
    UnionDeparturesResponse,
    ServiceExceptionStop,
    ServiceExceptionTrip,
    ServiceExceptionsResponse,
)
from app.models.schedules import (
    Variant,
    LineSummary,
    LinesAllResponse,
    LineScheduleResponse,
    LineScheduleTrip,
    LineRouteStop,
    LineStopsResponse,
    TripScheduleResponse,
    TripDetails,
    TripStopDetails,
)
from app.utils.utils import (
    format_date,
    as_list,
    trim_date_time,
    clean_str,
    to_int_safe,
    delay_status_from_seconds,
)


def transform_stops(raw_data: Dict[str, Any]) -> List[Stop]:
    """Transform raw stops data into Stop models"""
    stops = []
    stations_list = raw_data.get("Stations", {}).get("Station", [])
    
    if not isinstance(stations_list, list):
        stations_list = [stations_list]
    
    for station in stations_list:
        # Include all stops, not just trains
        stops.append(Stop(
            id=station.get("LocationCode", ""),
            name=station.get("LocationName", ""),
            type=station.get("LocationType", ""),
            public_id=station.get("PublicStopId")
        ))
    
    return stops


def transform_stop_details(raw_data: Dict[str, Any], stop_code: str) -> StopDetails:
    """Transform raw stop details into StopDetails model"""
    # API response has nested "Stop" object
    stop_data = raw_data.get("Stop", {})
    
    # Build address from components
    address = ""
    if stop_data.get("StreetNumber"):
        address += f"{stop_data.get('StreetNumber')} "
    if stop_data.get("StreetName"):
        address += f"{stop_data.get('StreetName')}, "
    if stop_data.get("City"):
        address += stop_data.get("City")
    
    # Convert latitude/longitude from string to float if present
    latitude = None
    longitude = None
    lat_str = stop_data.get("Latitude")
    lon_str = stop_data.get("Longitude")
    if lat_str:
        try:
            latitude = float(lat_str)
        except (ValueError, TypeError):
            pass
    if lon_str:
        try:
            longitude = float(lon_str)
        except (ValueError, TypeError):
            pass
    
    return StopDetails(
        stop_code=stop_code,
        stop_name=stop_data.get("StopName"),
        zone_code=stop_data.get("ZoneCode"),
        address=address,
        latitude=latitude,
        longitude=longitude
    )


def transform_next_service(raw_data: Dict[str, Any], stop_code: str) -> NextService:
    """Transform raw next service data into NextService model"""
    lines = []
    
    # Structure depends on actual API response
    line_data = raw_data.get("NextService", {}).get("Lines", [])
    if not isinstance(line_data, list):
        line_data = [line_data] if line_data else []
    
    for line in line_data:
        scheduled = line.get("ScheduledDepartureTime")
        computed = line.get("ComputedDepartureTime")
        
        # Platform number: use ActualPlatform if available, otherwise ScheduledPlatform
        platform_number = line.get("ActualPlatform") or line.get("ScheduledPlatform")
        
        # Convert latitude/longitude from string to float if present
        latitude = None
        longitude = None
        lat_val = line.get("Latitude")
        lon_val = line.get("Longitude")
        if lat_val and lat_val != -1.0:  # API uses -1.0 as null value
            try:
                latitude = float(lat_val)
            except (ValueError, TypeError):
                pass
        if lon_val and lon_val != -1.0:
            try:
                longitude = float(lon_val)
            except (ValueError, TypeError):
                pass
        
        lines.append(NextServiceLine(
            line_code=line.get("LineCode", ""),
            line_name=line.get("LineName", ""),
            service_type=line.get("ServiceType", ""),
            direction_name=line.get("DirectionName", ""),
            scheduled_departure_time=scheduled,
            computed_departure_time=computed,
            departure_status=line.get("DepartureStatus"),
            platform_number=platform_number,
            trip_order=line.get("TripOrder"),
            trip_number=line.get("TripNumber"),
            update_time=line.get("UpdateTime"),
            status=line.get("Status", ""),
            latitude=latitude,
            longitude=longitude
        ))
    
    return NextService(
        stop_code=stop_code,
        lines=lines
    )


def transform_journey(raw_data: Dict[str, Any], from_stop: str, to_stop: str, date: str, start_time: str) -> JourneyResponse:
    """Transform SchJourneys response into a compact frontend model."""
    journeys = []
    sch_journeys = as_list(raw_data.get("SchJourneys"))

    response_date = date
    response_from_stop = from_stop
    response_to_stop = to_stop
    response_start_time = start_time

    for sch in sch_journeys:
        if not isinstance(sch, dict):
            continue

        response_date = sch.get("Date") or response_date
        response_from_stop = sch.get("From") or response_from_stop
        response_to_stop = sch.get("To") or response_to_stop
        response_start_time = sch.get("Time") or response_start_time

        services = as_list(sch.get("Services"))
        for service in services:
            if not isinstance(service, dict):
                continue

            legs = []
            trips = as_list(service.get("Trips", {}).get("Trip"))

            for trip in trips:
                if not isinstance(trip, dict):
                    continue

                raw_stops = as_list(trip.get("Stops", {}).get("Stop"))
                raw_stops = [stop for stop in raw_stops if isinstance(stop, dict)]
                raw_stops.sort(key=lambda stop: stop.get("Order", 0))

                stops = [
                    JourneyStop(
                        code=stop.get("Code", ""),
                        order=stop.get("Order"),
                        time=stop.get("Time"),
                        is_major=bool(stop.get("IsMajor", False))
                    )
                    for stop in raw_stops
                ]

                legs.append(JourneyTrip(
                    number=trip.get("Number", ""),
                    display=trip.get("Display", ""),
                    line=trip.get("Line", ""),
                    direction=trip.get("Direction", ""),
                    vehicle_type=trip.get("Type", ""),
                    depart_from_code=trip.get("departFromCode", ""),
                    destination_stop_code=trip.get("destinationStopCode", ""),
                    stops=stops
                ))

            journeys.append(JourneyService(
                trip_hash=service.get("tripHash"),
                color=service.get("Colour"),
                start_time=service.get("StartTime", ""),
                end_time=service.get("EndTime", ""),
                duration=service.get("Duration"),
                transfer_count=service.get("transferCount", max(0, len(legs) - 1)),
                trips=legs
            ))

    return JourneyResponse(
        from_stop=response_from_stop,
        to_stop=response_to_stop,
        date=response_date,
        start_time=response_start_time,
        journeys=journeys
    )


def transform_lines_all(raw_data: Dict[str, Any], schedule_date: str) -> LinesAllResponse:
    """Transform Schedule/Line/All response into frontend-friendly line summaries."""
    lines_out = []
    raw_lines = as_list(raw_data.get("AllLines", {}).get("Line"))

    for raw_line in raw_lines:
        if not isinstance(raw_line, dict):
            continue

        raw_variants = as_list(raw_line.get("Variant"))
        variants = []
        directions = []

        for raw_variant in raw_variants:
            if not isinstance(raw_variant, dict):
                continue

            direction = raw_variant.get("Direction", "")
            if direction and direction not in directions:
                directions.append(direction)

            variants.append(Variant(
                code=raw_variant.get("Code", ""),
                display=raw_variant.get("Display", ""),
                direction=direction
            ))

        is_bus = bool(raw_line.get("IsBus", False))
        is_train = bool(raw_line.get("IsTrain", False))

        vehicle_types = []
        if is_train:
            vehicle_types.append("Train")
        if is_bus:
            vehicle_types.append("Bus")

        lines_out.append(LineSummary(
            code=raw_line.get("Code", ""),
            name=raw_line.get("Name", ""),
            vehicle_types=vehicle_types,
            directions=directions,
            variants=variants
        ))

    return LinesAllResponse(
        date=format_date(schedule_date),
        lines=lines_out
    )


def transform_line_schedule(
    raw_data: Dict[str, Any],
    schedule_date: str,
    line_code: str,
    direction: str
) -> LineScheduleResponse:
    """Transform Schedule/Line response into a compact, typed schedule payload."""
    lines = as_list(raw_data.get("Lines", {}).get("Line"))
    selected_line = next((line for line in lines if isinstance(line, dict)), {})

    trips_out = []
    for trip in as_list(selected_line.get("Trip")):
        if not isinstance(trip, dict):
            continue

        raw_stops = as_list(trip.get("Stops"))

        stops_out = []
        for stop in raw_stops:
            if not isinstance(stop, dict):
                continue
            stops_out.append(LineRouteStop(
                code=stop.get("Code", ""),
                order=int(stop.get("Order", 0)),
                time=trim_date_time(stop.get("Time", "")),
                is_major=bool(stop.get("IsMajor", False)),
            ))

        stops_out.sort(key=lambda stop: stop.order)
        trips_out.append(LineScheduleTrip(
            number=trip.get("Number", ""),
            display=trip.get("Display", ""),
            stops=stops_out,
        ))

    return LineScheduleResponse(
        date=format_date(schedule_date),
        line_code=selected_line.get("Code", line_code),
        direction=selected_line.get("Direction", direction),
        vehicle_type=selected_line.get("Type", ""),
        trips=trips_out,
    )


def transform_line_stops(
    raw_data: Dict[str, Any],
    schedule_date: str,
    line_code: str,
    direction: str
) -> LineStopsResponse:
    """Transform Schedule/Line/Stop response into a compact, typed stop list."""
    line = raw_data.get("Lines", {})
    if not isinstance(line, dict):
        line = {}

    stops = []
    for stop in as_list(line.get("Stop")):
        if not isinstance(stop, dict):
            continue
        stops.append(LineRouteStop(
            code=stop.get("Code", ""),
            order=int(stop.get("Order", 0)),
            name=stop.get("Name", ""),
            stop_type=stop.get("Type", ""),
            is_major=bool(stop.get("IsMajor", False)),
        ))

    stops.sort(key=lambda stop: stop.order)

    return LineStopsResponse(
        date=format_date(schedule_date),
        line_code=line.get("Code", line_code),
        direction=line.get("Direction", direction),
        display=line.get("Display", ""),
        stops=stops,
    )


def transform_trip_schedule(
    raw_data: Dict[str, Any],
    schedule_date: str,
    trip_number: str
) -> TripScheduleResponse:
    """Transform Schedule/Trip response into a typed trip payload."""
    trips_out = []
    for trip in as_list(raw_data.get("Trips")):
        if not isinstance(trip, dict):
            continue

        stops_out = []
        for stop in as_list(trip.get("Stops")):
            if not isinstance(stop, dict):
                continue

            arrival = stop.get("ArrivalTime", {}) if isinstance(stop.get("ArrivalTime"), dict) else {}
            departure = stop.get("DepartureTime", {}) if isinstance(stop.get("DepartureTime"), dict) else {}
            track = stop.get("Track", {}) if isinstance(stop.get("Track"), dict) else {}

            stops_out.append(TripStopDetails(
                code=stop.get("Code", ""),
                arrival_scheduled=clean_str(arrival.get("Scheduled")),
                arrival_computed=clean_str(arrival.get("Computed")),
                arrival_status=clean_str(arrival.get("Status")),
                departure_scheduled=clean_str(departure.get("Scheduled")),
                departure_computed=clean_str(departure.get("Computed")),
                departure_status=clean_str(departure.get("Status")),
                track_scheduled=clean_str(track.get("Scheduled")),
                track_actual=clean_str(track.get("Actual")),
                status=clean_str(stop.get("Status")),
                remark=clean_str(stop.get("Remark")),
            ))

        trips_out.append(TripDetails(
            trip_number=trip.get("Number", ""),
            destination=trip.get("Destination", ""),
            latitude=trip.get("Latitude"),
            longitude=trip.get("Longitude"),
            status=clean_str(trip.get("Status")),
            timestamp=clean_str(trip.get("TimeStamp")),
            stops=stops_out,
        ))

    return TripScheduleResponse(
        date=format_date(schedule_date),
        trips=trips_out,
    )

def transform_fares(
    raw_data: Dict[str, Any],
    from_stop: str,
    to_stop: str,
    operational_day: Optional[str]
) -> FaresResponse:
    """Transform AllFares response into a flat frontend-friendly model."""
    fare_options = []

    for category in as_list(raw_data.get("AllFares", {}).get("FareCategory")):
        if not isinstance(category, dict):
            continue

        rider_type = category.get("Type", "")
        for ticket in as_list(category.get("Tickets")):
            if not isinstance(ticket, dict):
                continue

            payment_type = ticket.get("Type", "")
            for fare in as_list(ticket.get("Fares")):
                if not isinstance(fare, dict):
                    continue
                fare_options.append(FareOption(
                    rider_type=rider_type,
                    payment_type=payment_type,
                    fare_type=fare.get("Type", ""),
                    amount=float(fare.get("Amount", 0)),
                    category=fare.get("Category"),
                ))

    return FaresResponse(
        from_stop=from_stop,
        to_stop=to_stop,
        operational_day=operational_day,
        fares=fare_options,
    )


def transform_service_at_a_glance(raw_data: Dict[str, Any], mode: str) -> ServiceAtGlanceResponse:
    """Transform ServiceataGlance payload into app-ready trip/status data."""
    raw_trips = as_list(raw_data.get("Trips", {}).get("Trip"))
    trips: List[ServiceTrip] = []

    in_motion_count = 0
    early_count = 0
    on_time_count = 0
    delayed_count = 0

    for raw_trip in raw_trips:
        if not isinstance(raw_trip, dict):
            continue

        delay_seconds = to_int_safe(raw_trip.get("DelaySeconds"))
        delay_minutes = round(delay_seconds / 60) if delay_seconds is not None else None
        delay_status = delay_status_from_seconds(delay_seconds)

        is_in_motion = bool(raw_trip.get("IsInMotion", False))
        at_station_code = clean_str(raw_trip.get("AtStationCode"))

        if is_in_motion:
            in_motion_count += 1
        if delay_status == "early":
            early_count += 1
        if delay_status == "on_time":
            on_time_count += 1
        if delay_status == "delayed":
            delayed_count += 1

        trips.append(ServiceTrip(
            trip_number=str(raw_trip.get("TripNumber", "")),
            line_code=str(raw_trip.get("LineCode", "")),
            route_number=clean_str(raw_trip.get("RouteNumber")),
            direction=clean_str(raw_trip.get("VariantDir")),
            display=str(raw_trip.get("Display", "")),
            start_time=clean_str(raw_trip.get("StartTime")),
            end_time=clean_str(raw_trip.get("EndTime")),
            cars=to_int_safe(raw_trip.get("Cars")),
            latitude=raw_trip.get("Latitude"),
            longitude=raw_trip.get("Longitude"),
            is_in_motion=is_in_motion,
            delay_seconds=delay_seconds,
            delay_minutes=delay_minutes,
            delay_status=delay_status,
            course=to_int_safe(raw_trip.get("Course")),
            first_stop_code=clean_str(raw_trip.get("FirstStopCode")),
            last_stop_code=clean_str(raw_trip.get("LastStopCode")),
            prev_stop_code=clean_str(raw_trip.get("PrevStopCode")),
            next_stop_code=clean_str(raw_trip.get("NextStopCode")),
            at_station_code=at_station_code,
            modified_at=clean_str(raw_trip.get("ModifiedDate")),
        ))

    return ServiceAtGlanceResponse(
        mode=mode,
        total_trips=len(trips),
        in_motion_trips=in_motion_count,
        early_trips=early_count,
        on_time_trips=on_time_count,
        delayed_trips=delayed_count,
        trips=trips,
    )


def transform_alerts(raw_data: Dict[str, Any], alert_type: str = "Service") -> List[Alert]:
    """Transform raw ServiceUpdate messages into Alert models."""
    alerts = []

    messages = as_list(raw_data.get("Messages", {}).get("Message"))
    for message in messages:
        if not isinstance(message, dict):
            continue

        lines = [
            clean_str(line.get("Code"))
            for line in as_list(message.get("Lines"))
            if isinstance(line, dict)
        ]
        stops = [
            clean_str(stop.get("Code"))
            for stop in as_list(message.get("Stops"))
            if isinstance(stop, dict)
        ]
        trips = [
            clean_str(trip.get("TripNumber"))
            for trip in as_list(message.get("Trips"))
            if isinstance(trip, dict)
        ]

        title_en = clean_str(message.get("SubjectEnglish")) or ""
        body_en = clean_str(message.get("BodyEnglish")) or ""

        alerts.append(Alert(
            code=str(message.get("Code", "")),
            parent_code=clean_str(message.get("ParentCode")),
            status=clean_str(message.get("Status")) or "",
            posted_at=clean_str(message.get("PostedDateTime")),
            alert_type=alert_type,
            title=title_en,
            body=body_en,
            category=clean_str(message.get("Category")),
            sub_category=clean_str(message.get("SubCategory")),
            affected_lines=[line for line in lines if line],
            affected_stops=[stop for stop in stops if stop],
            affected_trips=[trip for trip in trips if trip],
        ))

    return alerts


def transform_exceptions(raw_data: Dict[str, Any]) -> List[ServiceException]:
    """Transform raw exception data into ServiceException models"""
    exceptions = []
    
    exceptions_data = raw_data.get("Exceptions", {}).get("Exception", [])
    if not isinstance(exceptions_data, list):
        exceptions_data = [exceptions_data] if exceptions_data else []
    
    for exc_data in exceptions_data:
        affected_stops = exc_data.get("AffectedStops", {}).get("Stop", [])
        if not isinstance(affected_stops, list):
            affected_stops = [affected_stops] if affected_stops else []
        
        exceptions.append(ServiceException(
            trip_number=exc_data.get("TripNumber", ""),
            line_code=exc_data.get("LineCode", ""),
            line_name=exc_data.get("LineName", ""),
            direction=exc_data.get("Direction", ""),
            exception_type=exc_data.get("ExceptionType", "Cancelled"),
            affected_stops=[stop.get("StopCode", "") if isinstance(stop, dict) else str(stop) for stop in affected_stops],
            scheduled_date=exc_data.get("ScheduledDate", ""),
            scheduled_time=exc_data.get("ScheduledTime"),
            reason=exc_data.get("Reason")
        ))
    
    return exceptions


def transform_union_departures(raw_data: Dict[str, Any]) -> UnionDeparturesResponse:
    """Transform UnionDepartures/All payload into an app-ready departures board."""
    departures: List[UnionDeparture] = []
    raw_departures = as_list(raw_data.get("AllDepartures", {}).get("Trip"))

    for raw_departure in raw_departures:
        if not isinstance(raw_departure, dict):
            continue

        info = clean_str(raw_departure.get("Info")) or ""
        info_lower = info.lower()
        boarding_status = "proceed" if "proceed" in info_lower else "wait"

        raw_platform = clean_str(raw_departure.get("Platform"))
        platform = None if raw_platform in (None, "-", "--") else raw_platform

        stops = []
        for raw_stop in as_list(raw_departure.get("Stops")):
            if not isinstance(raw_stop, dict):
                continue
            stop_name = clean_str(raw_stop.get("Name"))
            if not stop_name:
                continue
            stops.append(UnionDepartureStop(
                name=stop_name,
                code=clean_str(raw_stop.get("Code")),
            ))

        destination = stops[-1].name if stops else None
        departure_datetime = clean_str(raw_departure.get("Time")) or ""

        departures.append(UnionDeparture(
            trip_number=str(raw_departure.get("TripNumber", "")),
            service=clean_str(raw_departure.get("Service")) or "",
            service_type=clean_str(raw_departure.get("ServiceType")) or "",
            info=info,
            boarding_status=boarding_status,
            departure_datetime=departure_datetime,
            departure_time=trim_date_time(departure_datetime),
            platform=platform,
            destination=destination,
            stops=stops,
        ))

    departures.sort(key=lambda dep: dep.departure_datetime)

    return UnionDeparturesResponse(
        generated_at=clean_str(raw_data.get("Metadata", {}).get("TimeStamp")),
        total_departures=len(departures),
        departures=departures,
    )


def transform_service_exceptions(raw_data: Dict[str, Any], mode: str) -> ServiceExceptionsResponse:
    """Transform ServiceUpdate/Exceptions payload into an app-friendly response."""
    trips_out: List[ServiceExceptionTrip] = []
    raw_trips = as_list(raw_data.get("Trip"))

    cancelled_count = 0
    override_count = 0
    stop_change_count = 0

    for raw_trip in raw_trips:
        if not isinstance(raw_trip, dict):
            continue

        is_cancelled = str(raw_trip.get("IsCancelled", "0")) == "1"
        is_override = str(raw_trip.get("IsOverride", "0")) == "1"

        stops_out: List[ServiceExceptionStop] = []
        for raw_stop in as_list(raw_trip.get("Stop")):
            if not isinstance(raw_stop, dict):
                continue
            stops_out.append(ServiceExceptionStop(
                order=to_int_safe(raw_stop.get("Order")),
                code=clean_str(raw_stop.get("Code")),
                name=clean_str(raw_stop.get("Name")),
                service_type=clean_str(raw_stop.get("ServiceType")),
                is_stopping=str(raw_stop.get("IsStopping", "1")) == "1",
                is_cancelled=str(raw_stop.get("IsCancelled", "0")) == "1",
                is_override=str(raw_stop.get("IsOverride", "0")) == "1",
                scheduled_arrival=clean_str(raw_stop.get("SchArrival")),
                scheduled_departure=clean_str(raw_stop.get("SchDeparture")),
                actual_time=clean_str(raw_stop.get("ActualTime")),
            ))

        has_stop_change = any(
            (not stop.is_stopping) or stop.is_cancelled or stop.is_override
            for stop in stops_out
        )

        if is_cancelled:
            exception_type = "cancelled"
            cancelled_count += 1
        elif is_override:
            exception_type = "override"
            override_count += 1
        elif has_stop_change:
            exception_type = "stop_change"
            stop_change_count += 1
        else:
            continue

        trips_out.append(ServiceExceptionTrip(
            trip_number=str(raw_trip.get("TripNumber", "")),
            trip_name=clean_str(raw_trip.get("TripName")),
            is_cancelled=is_cancelled,
            is_override=is_override,
            exception_type=exception_type,
            affected_stops=stops_out,
        ))

    return ServiceExceptionsResponse(
        mode=mode,
        generated_at=clean_str(raw_data.get("Metadata", {}).get("TimeStamp")),
        total_trips=len(trips_out),
        cancelled_trips=cancelled_count,
        override_trips=override_count,
        stop_change_trips=stop_change_count,
        trips=trips_out,
    )

