import httpx
from fastapi import APIRouter, Path, Query, HTTPException
from typing import Optional, List
from datetime import date
from app.clients.metrolinx import MetrolinxClient
from app.models.schedules import Line, LineSchedule, TripSchedule

router = APIRouter(prefix="/api/schedules", tags=["schedules"])
client = MetrolinxClient()

@router.get("/lines")
async def get_lines(
    schedule_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format (defaults to today)")
):
    """Get all lines in effect for a date"""
    if schedule_date is None:
        schedule_date = date.today().strftime("%Y-%m-%d")
    
    try:
        raw = await client.get_lines_all(schedule_date)
        # Return raw for now - can add transformer if needed
        # The structure depends on actual API response
        return raw
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching lines: {str(e)}")

@router.get("/lines/{line_code}/{direction}")
async def get_line_schedule(
    line_code: str = Path(..., description="Line code"),
    direction: str = Path(..., description="Line direction"),
    schedule_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format (defaults to today)")
):
    """Get line schedule details"""
    if schedule_date is None:
        schedule_date = date.today().strftime("%Y-%m-%d")
    
    try:
        raw = await client.get_line_schedule(schedule_date, line_code, direction)
        # Return raw for now - can add transformer if needed
        return raw
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Line {line_code} {direction} not found for date {schedule_date}")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching line schedule: {str(e)}")

@router.get("/lines/{line_code}/{direction}/stops")
async def get_line_stops(
    line_code: str = Path(..., description="Line code"),
    direction: str = Path(..., description="Line direction"),
    schedule_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format (defaults to today)")
):
    """Get stops for a line and direction"""
    if schedule_date is None:
        schedule_date = date.today().strftime("%Y-%m-%d")
    
    try:
        raw = await client.get_line_stops(schedule_date, line_code, direction)
        # Return raw for now - can add transformer if needed
        return raw
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Line {line_code} {direction} stops not found for date {schedule_date}")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching line stops: {str(e)}")

@router.get("/trips/{trip_number}")
async def get_trip_schedule(
    trip_number: str = Path(..., description="Trip number"),
    schedule_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format (defaults to today)")
):
    """Get trip details with all stops"""
    if schedule_date is None:
        schedule_date = date.today().strftime("%Y-%m-%d")
    
    try:
        raw = await client.get_trip_schedule(schedule_date, trip_number)
        # Return raw for now - can add transformer if needed
        return raw
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Trip {trip_number} not found for date {schedule_date}")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching trip schedule: {str(e)}")

