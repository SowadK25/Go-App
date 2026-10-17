import logging
from fastapi import APIRouter, HTTPException, Path, Query
from app.clients.transit_gtfs import TransitGtfsClient
from app.models.network_map import NetworkMap
from app.models.stops import Stop
from app.models.schedules import LinesAllResponse, LineScheduleResponse, LineSummary
from app.utils.utils import normalize_date, toronto_today
from app.utils.gtfs_departures import ScheduleDateUnavailable

router = APIRouter(prefix="/api/map", tags=["map"])
client = TransitGtfsClient()
logger = logging.getLogger(__name__)


@router.get("/schedules/lines", response_model=LinesAllResponse)
async def get_timetable_lines(schedule_date: str | None = Query(None)):
    date = normalize_date(schedule_date) if schedule_date else toronto_today()
    try:
        return await client.get_timetable_lines(date)
    except ScheduleDateUnavailable:
        raise HTTPException(status_code=404, detail="Schedules are not published for this date.") from None
    except Exception:
        raise HTTPException(status_code=503, detail="Timetables are temporarily unavailable. Please try again.") from None


@router.get("/schedules/lines/{line_code}/{direction}", response_model=LineScheduleResponse)
async def get_line_timetable(line_code: str, direction: str, schedule_date: str | None = Query(None)):
    date = normalize_date(schedule_date) if schedule_date else toronto_today()
    try:
        return await client.get_line_timetable(line_code, direction, date)
    except ScheduleDateUnavailable:
        raise HTTPException(status_code=404, detail="Schedules are not published for this date.") from None
    except KeyError:
        raise HTTPException(status_code=404, detail="No scheduled trips for this line and direction on this date.") from None
    except Exception:
        raise HTTPException(status_code=503, detail="Timetables are temporarily unavailable. Please try again.") from None


@router.get("/network", response_model=NetworkMap)
async def get_network_map():
    """All stops and published route shapes in the GO and UP GTFS feeds."""
    try:
        return await client.get_network()
    except Exception as exc:
        logger.warning("Network map unavailable: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="The network map is temporarily unavailable. Please try again.") from None


@router.get("/lines", response_model=list[LineSummary])
async def get_line_catalog():
    """Published names for every train/bus route, including lines not running today."""
    try:
        return await client.get_line_catalog()
    except Exception:
        raise HTTPException(status_code=503, detail="Route names are temporarily unavailable.") from None


@router.get("/lines/{line_code}/stops", response_model=list[Stop])
async def get_line_stations(line_code: str = Path(..., description="Published train or bus line code")):
    """Full line membership, independent of today's scheduled trip endpoints."""
    code = line_code.strip().upper()
    if code == "GT":
        code = "KI"
    network = await get_network_map()
    if not any(line.code == code for line in network.lines):
        raise HTTPException(status_code=404, detail="Line not found in the published network.")
    return [Stop(id=stop.id, name=stop.name, type=stop.type) for stop in network.stops if code in stop.line_codes]
