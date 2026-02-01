import httpx
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from datetime import date, datetime
from app.clients.metrolinx import MetrolinxClient
from app.models.journeys import JourneyResponse, FareResponse
from app import transformers as transform

router = APIRouter(prefix="/api/journeys", tags=["journeys"])
client = MetrolinxClient()

@router.get("", response_model=JourneyResponse)
async def get_journeys(
    from_stop: str = Query(..., description="Starting stop code"),
    to_stop: str = Query(..., description="Destination stop code"),
    journey_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format (defaults to today)"),
    start_time: Optional[str] = Query(None, description="Start time in HH:MM format (defaults to current time)"),
    max_journeys: int = Query(5, ge=1, le=10, description="Maximum number of journey options to return")
):
    """
    Get journey options between two stops.
    
    Returns multiple journey options with trip details, transfers, and stops.
    """
    # Default to today if no date provided
    if journey_date is None:
        journey_date = date.today().strftime("%Y-%m-%d")
    
    # Default to current time if no start time provided
    if start_time is None:
        now = datetime.now()
        start_time = now.strftime("%H:%M")
    
    try:
        raw_data = await client.get_journey(
            from_stop_code=from_stop,
            to_stop_code=to_stop,
            date=journey_date,
            start_time=start_time,
            max_journeys=max_journeys
        )
        
        return transform.transform_journey(raw_data, from_stop, to_stop, journey_date, start_time)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="No journeys found for the given stops")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching journeys: {str(e)}")

@router.get("/fares", response_model=FareResponse)
async def get_fares(
    from_stop: str = Query(..., description="Starting stop code"),
    to_stop: str = Query(..., description="Destination stop code"),
    operational_day: Optional[str] = Query(None, description="Operational day in YYYY-MM-DD format")
):
    """
    Get fare information between two stops.
    """
    try:
        if operational_day:
            raw_data = await client.get_fares(from_stop, to_stop, operational_day)
        else:
            raw_data = await client.get_fares(from_stop, to_stop)
        
        return transform.transform_fares(raw_data, from_stop, to_stop, operational_day)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="No fare information found")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching fares: {str(e)}")

