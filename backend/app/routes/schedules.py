import httpx
from fastapi import APIRouter, Path, Query, HTTPException
from typing import Optional
from app.clients.metrolinx import MetrolinxClient
from app.utils.errors import upstream_error
from app.models.schedules import LinesAllResponse, LineScheduleResponse, LineStopsResponse, TripScheduleResponse
from app import transformers as transform
from app.utils.utils import normalize_date, toronto_today

router = APIRouter(prefix="/api/schedules", tags=["schedules"])
client = MetrolinxClient()

# Cacheable endpoint (only changes daily)
@router.get("/lines", response_model=LinesAllResponse)
async def get_lines(
    schedule_date: Optional[str] = Query(None, description="Date in YYYYMMDD format (defaults to today)")
):
    """Get all lines in effect for a date"""
    schedule_date = normalize_date(schedule_date) if schedule_date is not None else toronto_today()
    
    try:
        raw = await client.get_lines_all(schedule_date)
        return transform.transform_lines_all(raw, schedule_date)
    except httpx.HTTPStatusError as e:
        raise upstream_error(e) from None
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Transit provider timed out. Please try again.") from None
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Unable to connect to transit provider.") from None
    except Exception:
        raise HTTPException(status_code=500, detail="Error fetching lines") from None

# Cacheable endpoint (only changes daily) - can also be cached by line_code+direction
@router.get(
    "/lines/{line_code}/{direction}",
    response_model=LineScheduleResponse,
    response_model_exclude_none=True,
)
async def get_line_schedule(
    line_code: str = Path(..., description="Line code"),
    direction: str = Path(..., description="Line direction"),
    schedule_date: Optional[str] = Query(None, description="Date in YYYYMMDD format (defaults to today)")
):
    """Get line schedule details"""
    schedule_date = normalize_date(schedule_date) if schedule_date is not None else toronto_today()
    
    try:
        raw = await client.get_line_schedule(schedule_date, line_code, direction)
        return transform.transform_line_schedule(raw, schedule_date, line_code, direction)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Line {line_code} {direction} not found for date {schedule_date}")
        raise upstream_error(e) from None
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Transit provider timed out. Please try again.") from None
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Unable to connect to transit provider.") from None
    except Exception:
        raise HTTPException(status_code=500, detail="Error fetching line schedule") from None

# Cacheable endpoint (only changes daily) - can also be cached by line_code+direction
@router.get(
    "/lines/{line_code}/{direction}/stops",
    response_model=LineStopsResponse,
    response_model_exclude_none=True,
)
async def get_line_stops(
    line_code: str = Path(..., description="Line code"),
    direction: str = Path(..., description="Line direction"),
    schedule_date: Optional[str] = Query(None, description="Date in YYYYMMDD format (defaults to today)")
):
    """Get stops for a line and direction"""
    schedule_date = normalize_date(schedule_date) if schedule_date is not None else toronto_today()
    
    try:
        raw = await client.get_line_stops(schedule_date, line_code, direction)
        return transform.transform_line_stops(raw, schedule_date, line_code, direction)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Line {line_code} {direction} stops not found for date {schedule_date}")
        raise upstream_error(e) from None
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Transit provider timed out. Please try again.") from None
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Unable to connect to transit provider.") from None
    except Exception:
        raise HTTPException(status_code=500, detail="Error fetching line stops") from None

@router.get(
    "/trips/{trip_number}",
    response_model=TripScheduleResponse,
    response_model_exclude_none=True,
)
async def get_trip_schedule(
    trip_number: str = Path(..., description="Trip number"),
    schedule_date: Optional[str] = Query(None, description="Date in YYYYMMDD format (defaults to today)")
):
    """Get trip details with all stops"""
    schedule_date = normalize_date(schedule_date) if schedule_date is not None else toronto_today()
    
    try:
        raw = await client.get_trip_schedule(schedule_date, trip_number)
        return transform.transform_trip_schedule(raw, schedule_date, trip_number)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Trip {trip_number} not found for date {schedule_date}")
        raise upstream_error(e) from None
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Transit provider timed out. Please try again.") from None
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Unable to connect to transit provider.") from None
    except Exception:
        raise HTTPException(status_code=500, detail="Error fetching trip schedule") from None
