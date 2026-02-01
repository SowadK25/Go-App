"""
Transform raw Metrolinx API responses into clean, frontend-friendly models
"""
from typing import List, Dict, Any, Optional
from app.models.stops import Stop, StopDetails, NextService, NextServicePrediction, Destination
from app.models.journeys import Journey, JourneyLeg, JourneyStop, JourneyResponse, Fare, FareResponse
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
    address_parts = []
    if stop_data.get("StreetNumber"):
        address_parts.append(stop_data.get("StreetNumber"))
    if stop_data.get("StreetName"):
        address_parts.append(stop_data.get("StreetName"))
    if stop_data.get("City"):
        address_parts.append(stop_data.get("City"))
    address = ", ".join(address_parts) if address_parts else None
    
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
        
        # Calculate minutes until arrival if we have a computed time
        minutes_until = None
        if computed:
            try:
                from datetime import datetime
                pred_time = datetime.strptime(computed, "%H:%M:%S")
                now = datetime.now()
                minutes_until = int((pred_time - now).total_seconds() / 60)
            except:
                pass
        
        lines.append(NextServicePrediction(
            line_code=line.get("LineCode", ""),
            line_name=line.get("LineName", ""),
            direction_name=line.get("DirectionName", ""),
            platform_number=line.get("ScheduledPlatform", ""),
            scheduled_departure_time=scheduled,
            computed_departure_time=computed,
            minutes_until=minutes_until,
            is_delayed=computed != scheduled if (computed and scheduled) else False,
            vehicle_type=line.get("VehicleType", "Train")
        ))
    
    return NextService(
        stop_code=stop_code,
        stop_name=raw_data.get("StopName", ""),
        lines=lines
    )


def transform_journey(raw_data: Dict[str, Any], from_stop: str, to_stop: str, date: str, start_time: str) -> JourneyResponse:
    """Transform raw journey data into JourneyResponse model"""
    journeys = []
    
    # Structure depends on actual API response
    journeys_data = raw_data.get("Journeys", {}).get("Journey", [])
    if not isinstance(journeys_data, list):
        journeys_data = [journeys_data] if journeys_data else []
    
    for journey_data in journeys_data:
        legs = []
        legs_data = journey_data.get("Legs", {}).get("Leg", [])
        if not isinstance(legs_data, list):
            legs_data = [legs_data] if legs_data else []
        
        for leg_data in legs_data:
            from_stop_data = leg_data.get("FromStop", {})
            to_stop_data = leg_data.get("ToStop", {})
            
            stops = []
            stops_data = leg_data.get("Stops", {}).get("Stop", [])
            if not isinstance(stops_data, list):
                stops_data = [stops_data] if stops_data else []
            
            for stop_data in stops_data:
                stops.append(JourneyStop(
                    stop_code=stop_data.get("StopCode", ""),
                    stop_name=stop_data.get("StopName", ""),
                    scheduled_arrival=stop_data.get("ScheduledArrival"),
                    scheduled_departure=stop_data.get("ScheduledDeparture"),
                    predicted_arrival=stop_data.get("PredictedArrival"),
                    predicted_departure=stop_data.get("PredictedDeparture")
                ))
            
            legs.append(JourneyLeg(
                line_code=leg_data.get("LineCode", ""),
                line_name=leg_data.get("LineName", ""),
                direction=leg_data.get("Direction", ""),
                trip_number=leg_data.get("TripNumber"),
                vehicle_type=leg_data.get("VehicleType", "Train"),
                from_stop=JourneyStop(
                    stop_code=from_stop_data.get("StopCode", ""),
                    stop_name=from_stop_data.get("StopName", ""),
                    scheduled_departure=from_stop_data.get("ScheduledDeparture")
                ),
                to_stop=JourneyStop(
                    stop_code=to_stop_data.get("StopCode", ""),
                    stop_name=to_stop_data.get("StopName", ""),
                    scheduled_arrival=to_stop_data.get("ScheduledArrival")
                ),
                stops=stops,
                duration_minutes=leg_data.get("DurationMinutes")
            ))
        
        journeys.append(Journey(
            journey_id=journey_data.get("JourneyId"),
            from_stop_code=from_stop,
            from_stop_name=journey_data.get("FromStopName", ""),
            to_stop_code=to_stop,
            to_stop_name=journey_data.get("ToStopName", ""),
            departure_time=journey_data.get("DepartureTime", ""),
            arrival_time=journey_data.get("ArrivalTime", ""),
            duration_minutes=journey_data.get("DurationMinutes"),
            legs=legs,
            transfers=len(legs) - 1 if len(legs) > 0 else 0,
            fare=journey_data.get("Fare"),
            fare_currency="CAD"
        ))
    
    return JourneyResponse(
        from_stop=from_stop,
        to_stop=to_stop,
        date=date,
        start_time=start_time,
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

