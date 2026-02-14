import httpx
from fastapi import APIRouter, Path, Query, HTTPException
from typing import List
from app.clients.metrolinx import MetrolinxClient
from app.models.stops import Stop, StopDetails, NextService
from app import transformers as transform

router = APIRouter(prefix="/api/stops", tags=["stops"])
client = MetrolinxClient()

@router.get("", response_model=List[Stop])
async def get_all_stops():
    """Get all stops/stations"""
    try:
        raw = await client.get_stops_all()
        return transform.transform_stops(raw)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stops: {str(e)}")

@router.get("/{stop_code}/next-service", response_model=NextService)
async def get_stop_next_service(stop_code: str = Path(..., description="Stop code")):
    """Get predictions for all lines that feed a stop"""
    try:
        raw = await client.get_stop_next_service(stop_code)
        return transform.transform_next_service(raw, stop_code)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Stop {stop_code} not found")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching next service: {str(e)}")

@router.get("/{stop_code}/details", response_model=StopDetails)
async def get_stop_details(stop_code: str = Path(..., description="Stop code")):
    """Get detailed stop information"""
    try:
        raw = await client.get_stop_details(stop_code)
        return transform.transform_stop_details(raw, stop_code)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Stop {stop_code} not found")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stop details: {str(e)}")
