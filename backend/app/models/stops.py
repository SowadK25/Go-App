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
    direction: str
    destination: str
    scheduled_time: Optional[str] = None
    predicted_time: Optional[str] = None
    minutes_until: Optional[int] = None
    is_delayed: bool = False
    vehicle_type: Optional[str] = None  # "Train", "Bus", "UPX"

class NextService(BaseModel):
    """Next service information for a stop"""
    stop_code: str
    stop_name: str
    lines: List[NextServiceLine]

class Destination(BaseModel):
    """Destination available from a stop"""
    stop_code: str
    stop_name: str
    line_code: str
    line_name: str
    direction: str

