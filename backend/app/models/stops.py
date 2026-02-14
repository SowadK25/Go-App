from pydantic import BaseModel, Field
from typing import Optional, List

class Stop(BaseModel):
    """Stop/Station information"""
    id: str = Field(..., description="Stop code")
    name: str = Field(..., description="Stop name")
    type: str = Field(..., description="Location type (e.g., Train, Bus)")
    public_id: Optional[str] = Field(None, description="Public stop ID")

class StopDetails(BaseModel):
    """Detailed stop information"""
    stop_code: str
    stop_name: str
    zone_code: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class NextServiceLine(BaseModel):
    """Next service prediction for a line"""
    line_code: str
    line_name: str
    service_type: str  # "T" for Train, "B" for Bus, etc.
    direction_name: str
    scheduled_departure_time: str
    computed_departure_time: Optional[str] = None
    departure_status: Optional[str] = None
    platform_number: Optional[str] = None  # ActualPlatform if available, else ScheduledPlatform
    trip_order: Optional[int] = None
    trip_number: Optional[str] = None
    update_time: Optional[str] = None
    status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class NextService(BaseModel):
    """Next service information for a stop"""
    stop_code: str
    lines: List[NextServiceLine]
