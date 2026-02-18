from pydantic import BaseModel, Field
from typing import Optional, List

class JourneyStop(BaseModel):
    """Stop timeline item"""
    code: str
    order: Optional[int] = None
    time: Optional[str] = None
    is_major: bool = True

class JourneyTrip(BaseModel):
    """Single trip segment used in a journey option"""
    number: str
    display: str
    line: str
    direction: str
    vehicle_type: str
    depart_from_code: str
    destination_stop_code: str
    stops: List[JourneyStop] = Field(default_factory=list)

class JourneyService(BaseModel):
    """Journey option with one or more legs"""
    trip_hash: Optional[str] = None
    color: Optional[str] = None
    start_time: str
    end_time: str
    duration: Optional[str] = None
    transfer_count: int = 0
    trips: List[JourneyTrip] = Field(default_factory=list)

class JourneyResponse(BaseModel):
    """Scheduled journey list"""
    from_stop: str
    to_stop: str
    date: str
    start_time: str
    journeys: List[JourneyService]

class Fare(BaseModel):
    """Fare information"""
    fare_type: str  # "Adult", "Student", "Senior", etc.
    price: float
    currency: str = "CAD"

class FareResponse(BaseModel):
    """Fare response"""
    from_stop: str
    to_stop: str
    operational_day: Optional[str] = None
    fares: List[Fare]

