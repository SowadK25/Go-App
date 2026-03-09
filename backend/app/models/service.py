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
