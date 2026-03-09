from pydantic import BaseModel, Field
from typing import Optional, List

class Alert(BaseModel):
    """Service or information alert message."""
    code: str
    parent_code: Optional[str] = None
    status: str  # INIT, UPD
    posted_at: Optional[str] = None
    alert_type: str  # Service, Information
    title: str
    body: str
    category: Optional[str] = None
    sub_category: Optional[str] = None
    affected_lines: List[str] = Field(default_factory=list)
    affected_stops: List[str] = Field(default_factory=list)
    affected_trips: List[str] = Field(default_factory=list)

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
