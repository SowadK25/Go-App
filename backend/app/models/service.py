from pydantic import BaseModel, Field
from typing import List, Optional


class ServiceTrip(BaseModel):
    """Active in-service trip from Service at a Glance."""
    trip_number: str
    line_code: str
    route_number: Optional[str] = None
    direction: Optional[str] = None
    display: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    cars: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_in_motion: bool = False
    delay_seconds: Optional[int] = None
    delay_minutes: Optional[int] = None
    delay_status: Optional[str] = None  # early | on_time | delayed
    course: Optional[int] = None
    first_stop_code: Optional[str] = None
    last_stop_code: Optional[str] = None
    prev_stop_code: Optional[str] = None
    next_stop_code: Optional[str] = None
    at_station_code: Optional[str] = None
    modified_at: Optional[str] = None


class ServiceAtGlanceResponse(BaseModel):
    """Frontend-friendly Service at a Glance response."""
    mode: str  # train | bus
    total_trips: int = 0
    in_motion_trips: int = 0
    early_trips: int = 0
    on_time_trips: int = 0
    delayed_trips: int = 0
    trips: List[ServiceTrip] = Field(default_factory=list)


class UnionDeparture(BaseModel):
    """Departure from Union Station."""
    trip_number: str
    service: str
    service_type: str
    info: str
    boarding_status: str  # proceed | wait
    departure_datetime: str
    departure_time: str
    platform: Optional[str] = None
    destination: Optional[str] = None
    stops: List["UnionDepartureStop"] = Field(default_factory=list)


class UnionDepartureStop(BaseModel):
    """Stop on the Union departure trip pattern."""
    name: str
    code: Optional[str] = None


class UnionDeparturesResponse(BaseModel):
    """Frontend-friendly Union departures board payload."""
    generated_at: Optional[str] = None
    total_departures: int = 0
    departures: List[UnionDeparture] = Field(default_factory=list)


class ServiceExceptionStop(BaseModel):
    """Stop-level exception details for a trip."""
    order: Optional[int] = None
    code: Optional[str] = None
    name: Optional[str] = None
    service_type: Optional[str] = None
    is_stopping: bool = True
    is_cancelled: bool = False
    is_override: bool = False
    scheduled_arrival: Optional[str] = None
    scheduled_departure: Optional[str] = None
    actual_time: Optional[str] = None


class ServiceExceptionTrip(BaseModel):
    """Trip-level exception summary."""
    trip_number: str
    trip_name: Optional[str] = None
    is_cancelled: bool = False
    is_override: bool = False
    exception_type: str  # cancelled | override | stop_change
    affected_stops: List[ServiceExceptionStop] = Field(default_factory=list)


class ServiceExceptionsResponse(BaseModel):
    """Frontend-friendly service exceptions response."""
    mode: str  # train | bus | all
    generated_at: Optional[str] = None
    total_trips: int = 0
    cancelled_trips: int = 0
    override_trips: int = 0
    stop_change_trips: int = 0
    trips: List[ServiceExceptionTrip] = Field(default_factory=list)
