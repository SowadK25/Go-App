import httpx
from fastapi import APIRouter, Path, Query, HTTPException
from typing import List
from app.clients.metrolinx import MetrolinxClient
from app.utils.errors import upstream_error
from app.models.stops import Stop, StopDetails, NextService, StationDepartures
from app.routes.network_map import client as gtfs_client
from app.utils.gtfs_departures import ScheduleDateUnavailable
from app.utils.utils import normalize_date, toronto_today
from app import transformers as transform

router = APIRouter(prefix="/api/stops", tags=["stops"])
client = MetrolinxClient()


@router.get("/{stop_code}/departures", response_model=StationDepartures)
async def get_station_departures(stop_code: str, schedule_date: str | None = Query(None)):
    date = normalize_date(schedule_date) if schedule_date else toronto_today()
    try:
        return await gtfs_client.get_station_departures(stop_code, date)
    except ScheduleDateUnavailable:
        raise HTTPException(status_code=404, detail="Schedules are not published for the selected date.") from None
    except KeyError:
        raise HTTPException(status_code=404, detail="Station not found in the published timetable.") from None
    except Exception:
        raise HTTPException(status_code=503, detail="Station schedules are temporarily unavailable. Please try again.") from None

@router.get("", response_model=List[Stop])
async def get_all_stops():
    """Get all stops/stations"""
    try:
        raw = await client.get_stops_all()
        return transform.transform_stops(raw)
    except httpx.HTTPStatusError as e:
        raise upstream_error(e) from None
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Transit provider timed out. Please try again.") from None
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Unable to connect to transit provider.") from None
    except Exception:
        raise HTTPException(status_code=500, detail="Error fetching stops") from None

@router.get("/{stop_code}/next-service", response_model=NextService)
async def get_stop_next_service(stop_code: str = Path(..., description="Stop code")):
    """Get predictions for all lines that feed a stop"""
    try:
        raw = await client.get_stop_next_service(stop_code)
        return transform.transform_next_service(raw, stop_code)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Stop {stop_code} not found")
        raise upstream_error(e) from None
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Transit provider timed out. Please try again.") from None
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Unable to connect to transit provider.") from None
    except Exception:
        raise HTTPException(status_code=500, detail="Error fetching next service") from None

@router.get("/{stop_code}/details", response_model=StopDetails)
async def get_stop_details(stop_code: str = Path(..., description="Stop code")):
    """Get detailed stop information"""
    try:
        raw = await client.get_stop_details(stop_code)
        return transform.transform_stop_details(raw, stop_code)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Stop {stop_code} not found")
        raise upstream_error(e) from None
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Transit provider timed out. Please try again.") from None
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Unable to connect to transit provider.") from None
    except Exception:
        raise HTTPException(status_code=500, detail="Error fetching stop details") from None
