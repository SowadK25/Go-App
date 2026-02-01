from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class Alert(BaseModel):
    """Service or information alert"""
    id: Optional[str] = None
    title: str
    description: str
    alert_type: str  # "Service", "Information"
    severity: Optional[str] = None  # "High", "Medium", "Low"
    affected_lines: List[str] = Field(default_factory=list)
    affected_stops: List[str] = Field(default_factory=list)
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class ServiceException(BaseModel):
    """Schedule exception (cancellation, delay, etc.)"""
    trip_number: str
    line_code: str
    line_name: str
    direction: str
    exception_type: str  # "Cancelled", "Delayed", "Modified"
    affected_stops: List[str] = Field(default_factory=list)
    scheduled_date: str
    scheduled_time: Optional[str] = None
    reason: Optional[str] = None

class UnionDeparture(BaseModel):
    """Departure from Union Station"""
    trip_number: str
    line_code: str
    line_name: str
    direction: str
    destination: str
    scheduled_departure: str
    predicted_departure: Optional[str] = None
    platform: Optional[str] = None
    vehicle_type: str  # "Train", "Bus", "UPX"
    status: Optional[str] = None  # "On Time", "Delayed", "Cancelled"

