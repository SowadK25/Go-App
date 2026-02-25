from pydantic import BaseModel, Field
from typing import Optional, List

class Variant(BaseModel):
    """Line variant (e.g. different routes for same line)"""
    code: str
    display: str
    direction: str

class Line(BaseModel):
    """Line information"""
    code: str
    name: str
    direction: str
    vehicle_type: str  # "Train", "Bus"
    variant: List[Variant] = Field(default_factory=list)

class LineSummary(BaseModel):
    """Line summary for Schedule/Line/All"""
    code: str
    name: str
    vehicle_types: List[str] = Field(default_factory=list)
    directions: List[str] = Field(default_factory=list)
    variants: List[Variant] = Field(default_factory=list)

class LinesAllResponse(BaseModel):
    """All lines in effect for a date"""
    date: str
    lines: List[LineSummary] = Field(default_factory=list)

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

