import httpx
from fastapi import APIRouter, HTTPException
from app.clients.metrolinx import MetrolinxClient
from app.models.service import ServiceAtGlanceResponse
from app import transformers as transform

router = APIRouter(prefix="/api/service", tags=["service"])
client = MetrolinxClient()


@router.get("/trains", response_model=ServiceAtGlanceResponse, response_model_exclude_none=True)
async def get_service_trains():
    """Get all currently in-service trains."""
    try:
        raw = await client.get_service_trains()
        return transform.transform_service_at_a_glance(raw, mode="train")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching train service status: {str(e)}")


@router.get("/buses", response_model=ServiceAtGlanceResponse, response_model_exclude_none=True)
async def get_service_buses():
    """Get all currently in-service buses."""
    try:
        raw = await client.get_service_buses()
        return transform.transform_service_at_a_glance(raw, mode="bus")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching bus service status: {str(e)}")
