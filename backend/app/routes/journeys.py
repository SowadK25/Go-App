import httpx
from fastapi import APIRouter, Query, HTTPException, Path
from typing import Optional
from app.clients.metrolinx import MetrolinxClient
from app.models.journeys import JourneyResponse, FareResponse
from app import transformers as transform

router = APIRouter(prefix="/api/journeys", tags=["journeys"])
client = MetrolinxClient()

def _normalize_date(value: str) -> str:
    normalized = "".join(ch for ch in value if ch.isdigit())
    if len(normalized) != 8:
        raise HTTPException(status_code=422, detail="journey_date must be in YYYYMMDD or YYYY-MM-DD format")
    return normalized

def _normalize_time(value: str) -> str:
    normalized = "".join(ch for ch in value if ch.isdigit())
    if len(normalized) != 4:
        raise HTTPException(status_code=422, detail="start_time must be in HHMM or HH:MM format")
    return normalized

async def _fetch_journeys(from_stop: str, to_stop: str, journey_date: str, start_time: str, max_journeys: int) -> JourneyResponse:
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

@router.get("/{from_stop}/{to_stop}/{journey_date}/{start_time}", response_model=JourneyResponse)
async def get_journeys(
    from_stop: str = Path(..., description="Starting stop code"),
    to_stop: str = Path(..., description="Destination stop code"),
    journey_date: str = Path(..., description="Date in YYYYMMDD or YYYY-MM-DD format"),
    start_time: str = Path(..., description="Start time in HHMM or HH:MM format"),
    max_journeys: int = Query(5, ge=1, le=10, description="Maximum number of journey options to return")
):
    journey_date = _normalize_date(journey_date)
    start_time = _normalize_time(start_time)
    return await _fetch_journeys(from_stop, to_stop, journey_date, start_time, max_journeys)

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

