import httpx
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.clients.metrolinx import MetrolinxClient
from app.models.fares import FaresResponse
from app import transformers as transform
from app.utils.utils import normalize_date

router = APIRouter(prefix="/api/fares", tags=["fares"])
client = MetrolinxClient()


@router.get("/{from_stop}/{to_stop}", response_model=FaresResponse, response_model_exclude_none=True)
async def get_fares(
    from_stop: str,
    to_stop: str,
    operational_day: Optional[str] = Query(None, description="Optional date in YYYYMMDD or YYYY-MM-DD format"),
):
    """Get the fare between two stops."""
    try:
        normalized_day = normalize_date(operational_day) if operational_day else None
        raw_data = await client.get_fares(from_stop, to_stop, normalized_day)
        return transform.transform_fares(raw_data, from_stop, to_stop, normalized_day)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="No fare information found")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching fares: {str(e)}")
