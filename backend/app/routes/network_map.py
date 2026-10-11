import logging
from fastapi import APIRouter, HTTPException
from app.clients.gtfs import GtfsClient
from app.models.network_map import NetworkMap

router = APIRouter(prefix="/api/map", tags=["map"])
client = GtfsClient()
logger = logging.getLogger(__name__)


@router.get("/network", response_model=NetworkMap)
async def get_network_map():
    """All stops and published train/bus route shapes in the GO GTFS feed."""
    try:
        return await client.get_network()
    except Exception as exc:
        logger.warning("Network map unavailable: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="The network map is temporarily unavailable. Please try again.") from None
