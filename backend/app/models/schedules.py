from pydantic import BaseModel, Field
from typing import Optional, List

class Line(BaseModel):
    """Line information"""
    code: str
    name: str
    direction: str
    vehicle_type: str  # "Train", "Bus", "UPX"

class LineStop(BaseModel):
    """Stop on a line"""
    stop_code: str
    stop_name: str
    sequence: int
    scheduled_time: Optional[str] = None

class LineSchedule(BaseModel):
    """Schedule for a line"""
    line_code: str
    line_name: str
    direction: str
    date: str
    trips: List[dict] = Field(default_factory=list)  # Will contain trip details

class TripStop(BaseModel):
    """Stop on a trip"""
    stop_code: str
    stop_name: str
    sequence: int
    scheduled_arrival: Optional[str] = None
    scheduled_departure: Optional[str] = None

class TripSchedule(BaseModel):
    """Complete trip schedule"""
    trip_number: str
    line_code: str
    line_name: str
    direction: str
    date: str
    stops: List[TripStop]

