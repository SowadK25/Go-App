import httpx
import logging
from fastapi import APIRouter, Query, HTTPException, Path
from app.clients.metrolinx import MetrolinxClient
from app.clients.go_schedules import GoSchedulesClient
from app.utils.official_journeys import transform_timetable, select_journeys
from app.utils.errors import upstream_error
from app.models.journeys import JourneyResponse
from app import transformers as transform
from app.utils.utils import normalize_date, normalize_time

router = APIRouter(prefix="/api/journeys", tags=["journeys"])
client = MetrolinxClient()
official_client = GoSchedulesClient()
logger = logging.getLogger(__name__)

async def _fetch_journeys(from_stop: str, to_stop: str, journey_date: str, start_time: str, max_journeys: int) -> JourneyResponse:
    try:
        try:
            payload = await official_client.get_timetable(from_stop, to_stop, journey_date)
            result = transform_timetable(payload, from_stop, to_stop, journey_date, start_time)
        except Exception as exc:
            logger.warning("Official timetable unavailable; using Open Data: %s", type(exc).__name__)
            payload = await client.get_journey(
                from_stop_code=from_stop, to_stop_code=to_stop, date=journey_date,
                start_time=start_time, max_journeys=max_journeys,
            )
            result = transform.transform_journey(payload, from_stop, to_stop, journey_date, start_time)
        result.journeys = select_journeys(result, max_journeys)
        return result
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="No journeys found for the given stops")
        raise upstream_error(e) from None
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Transit provider timed out. Please try again.") from None
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Unable to connect to transit provider.") from None
    except Exception:
        raise HTTPException(status_code=500, detail="Error fetching journeys") from None

@router.get("/{from_stop}/{to_stop}/{journey_date}/{start_time}", response_model=JourneyResponse)
async def get_journeys(
    from_stop: str = Path(..., description="Starting stop code"),
    to_stop: str = Path(..., description="Destination stop code"),
    journey_date: str = Path(..., description="Date in YYYYMMDD or YYYY-MM-DD format"),
    start_time: str = Path(..., description="Start time in HHMM or HH:MM format"),
    max_journeys: int = Query(5, ge=1, le=10, description="Maximum number of journey options to return")
):
    journey_date = normalize_date(journey_date)
    start_time = normalize_time(start_time)
    return await _fetch_journeys(from_stop, to_stop, journey_date, start_time, max_journeys)
