from pydantic import BaseModel, Field
from typing import Optional, List

class JourneyStop(BaseModel):
    """Stop within a journey leg"""
    stop_code: str
    stop_name: str
    scheduled_arrival: Optional[str] = None
    scheduled_departure: Optional[str] = None
    predicted_arrival: Optional[str] = None
    predicted_departure: Optional[str] = None

class JourneyLeg(BaseModel):
    """A single leg of a journey (one trip)"""
    line_code: str
    line_name: str
    direction: str
    trip_number: Optional[str] = None
    vehicle_type: str  # "Train", "Bus", "UPX"
    from_stop: JourneyStop
    to_stop: JourneyStop
    stops: List[JourneyStop] = Field(default_factory=list)
    duration_minutes: Optional[int] = None

class Journey(BaseModel):
    """A complete journey option"""
    journey_id: Optional[str] = None
    from_stop_code: str
    from_stop_name: str
    to_stop_code: str
    to_stop_name: str
    departure_time: str
    arrival_time: str
    duration_minutes: Optional[int] = None
    legs: List[JourneyLeg]
    transfers: int = 0
    fare: Optional[float] = None
    fare_currency: str = "CAD"

class JourneyResponse(BaseModel):
    """Response containing journey options"""
    from_stop: str
    to_stop: str
    date: str
    start_time: str
    journeys: List[Journey]

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

