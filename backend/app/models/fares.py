from pydantic import BaseModel, Field
from typing import List, Optional


class FareOption(BaseModel):
    """Flat fare row"""
    rider_type: str
    payment_type: str
    fare_type: str
    amount: float
    category: Optional[str] = None
    currency: str = "CAD" # Always CAD


class FaresResponse(BaseModel):
    """Flat fares response for a stop pair."""
    from_stop: str
    to_stop: str
    operational_day: Optional[str] = None
    fares: List[FareOption] = Field(default_factory=list)
