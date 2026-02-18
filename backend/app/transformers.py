"""
Transform raw Metrolinx API responses into clean, frontend-friendly models
"""
from typing import List, Dict, Any, Optional
from app.models.stops import NextServiceLine, Stop, StopDetails, NextService
from app.models.journeys import JourneyResponse, JourneyService, JourneyTrip, JourneyStop, Fare, FareResponse
from app.models.alerts import Alert, ServiceException, UnionDeparture
from app.models.schedules import Line, LineSchedule, TripSchedule, TripStop


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

    def _as_list(value: Any) -> List[Any]:
        if value is None:
            return []
        if isinstance(value, list):
            return value
        return [value]

    sch_journeys = _as_list(raw_data.get("SchJourneys"))

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

        services = _as_list(sch.get("Services"))
        for service in services:
            if not isinstance(service, dict):
                continue

            legs = []
            trips = _as_list(service.get("Trips", {}).get("Trip"))

            for trip in trips:
                if not isinstance(trip, dict):
                    continue

                raw_stops = _as_list(trip.get("Stops", {}).get("Stop"))
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


def transform_fares(raw_data: Dict[str, Any], from_stop: str, to_stop: str, operational_day: Optional[str]) -> FareResponse:
    """Transform raw fare data into FareResponse model"""
    fares = []
    
    fares_data = raw_data.get("Fares", {}).get("Fare", [])
    if not isinstance(fares_data, list):
        fares_data = [fares_data] if fares_data else []
    
    for fare_data in fares_data:
        fares.append(Fare(
            fare_type=fare_data.get("FareType", "Adult"),
            price=float(fare_data.get("Price", 0)),
            currency=fare_data.get("Currency", "CAD")
        ))
    
    return FareResponse(
        from_stop=from_stop,
        to_stop=to_stop,
        operational_day=operational_day,
        fares=fares
    )


def transform_alerts(raw_data: Dict[str, Any], alert_type: str = "Service") -> List[Alert]:
    """Transform raw alert data into Alert models"""
    alerts = []
    
    alerts_data = raw_data.get("Alerts", {}).get("Alert", [])
    if not isinstance(alerts_data, list):
        alerts_data = [alerts_data] if alerts_data else []
    
    for alert_data in alerts_data:
        affected_lines = alert_data.get("AffectedLines", {}).get("Line", [])
        if not isinstance(affected_lines, list):
            affected_lines = [affected_lines] if affected_lines else []
        
        affected_stops = alert_data.get("AffectedStops", {}).get("Stop", [])
        if not isinstance(affected_stops, list):
            affected_stops = [affected_stops] if affected_stops else []
        
        alerts.append(Alert(
            id=alert_data.get("AlertId"),
            title=alert_data.get("Title", ""),
            description=alert_data.get("Description", ""),
            alert_type=alert_type,
            severity=alert_data.get("Severity"),
            affected_lines=[line.get("LineCode", "") if isinstance(line, dict) else str(line) for line in affected_lines],
            affected_stops=[stop.get("StopCode", "") if isinstance(stop, dict) else str(stop) for stop in affected_stops],
            start_time=alert_data.get("StartTime"),
            end_time=alert_data.get("EndTime"),
            created_at=alert_data.get("CreatedAt"),
            updated_at=alert_data.get("UpdatedAt")
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


def transform_union_departures(raw_data: Dict[str, Any]) -> List[UnionDeparture]:
    """Transform raw Union departures data into UnionDeparture models"""
    departures = []
    
    departures_data = raw_data.get("Departures", {}).get("Departure", [])
    if not isinstance(departures_data, list):
        departures_data = [departures_data] if departures_data else []
    
    for dep_data in departures_data:
        departures.append(UnionDeparture(
            trip_number=dep_data.get("TripNumber", ""),
            line_code=dep_data.get("LineCode", ""),
            line_name=dep_data.get("LineName", ""),
            direction=dep_data.get("Direction", ""),
            destination=dep_data.get("Destination", ""),
            scheduled_departure=dep_data.get("ScheduledDeparture", ""),
            predicted_departure=dep_data.get("PredictedDeparture"),
            platform=dep_data.get("Platform"),
            vehicle_type=dep_data.get("VehicleType", "Train"),
            status=dep_data.get("Status")
        ))
    
    return departures

