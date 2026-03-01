from pydantic import BaseModel, Field
from typing import Optional, List

class Variant(BaseModel):
    """Line variant (e.g. different routes for same line)"""
    code: str
    display: str
    direction: str

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

class LineRouteStop(BaseModel):
    """Reusable stop model for line schedule and line stops endpoints"""
    code: str
    order: int
    time: Optional[str] = None
    name: Optional[str] = None
    stop_type: Optional[str] = None
    is_major: bool = False

class LineScheduleTrip(BaseModel):
    """Single trip for a line+direction schedule"""
    number: str
    display: str
    stops: List[LineRouteStop] = Field(default_factory=list)

class LineScheduleResponse(BaseModel):
    """Schedule payload for /lines/{line_code}/{direction}"""
    date: str
    line_code: str
    direction: str
    vehicle_type: str
    trips: List[LineScheduleTrip] = Field(default_factory=list)

class LineStopsResponse(BaseModel):
    """Stops payload for /lines/{line_code}/{direction}/stops"""
    date: str
    line_code: str
    direction: str
    display: str
    stops: List[LineRouteStop] = Field(default_factory=list)

