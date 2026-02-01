import httpx
from fastapi import APIRouter, HTTPException
from typing import List
from app.clients.metrolinx import MetrolinxClient
from app.models.alerts import Alert, ServiceException, UnionDeparture
from app import transformers as transform

router = APIRouter(prefix="/api/alerts", tags=["alerts"])
client = MetrolinxClient()

@router.get("/service", response_model=List[Alert])
async def get_service_alerts():
    """Get service alert messages"""
    try:
        raw = await client.get_service_alerts()
        return transform.transform_alerts(raw, "Service")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching service alerts: {str(e)}")

@router.get("/information", response_model=List[Alert])
async def get_information_alerts():
    """Get information alert messages"""
    try:
        raw = await client.get_information_alerts()
        return transform.transform_alerts(raw, "Information")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching information alerts: {str(e)}")

@router.get("/all")
async def get_all_alerts():
    """Get all alert types combined"""
    try:
        service_raw = await client.get_service_alerts()
        information_raw = await client.get_information_alerts()
        
        return {
            "service_alerts": transform.transform_alerts(service_raw, "Service"),
            "information_alerts": transform.transform_alerts(information_raw, "Information")
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching alerts: {str(e)}")

@router.get("/exceptions/train", response_model=List[ServiceException])
async def get_train_exceptions():
    """Get train schedule exceptions (cancellations, etc.)"""
    try:
        raw = await client.get_exceptions_train()
        return transform.transform_exceptions(raw)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching train exceptions: {str(e)}")

@router.get("/exceptions/bus", response_model=List[ServiceException])
async def get_bus_exceptions():
    """Get bus schedule exceptions"""
    try:
        raw = await client.get_exceptions_bus()
        return transform.transform_exceptions(raw)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching bus exceptions: {str(e)}")

@router.get("/exceptions/all", response_model=List[ServiceException])
async def get_all_exceptions():
    """Get all schedule exceptions"""
    try:
        raw = await client.get_exceptions_all()
        return transform.transform_exceptions(raw)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching exceptions: {str(e)}")

@router.get("/union/departures", response_model=List[UnionDeparture])
async def get_union_departures():
    """Get nearest departures from Union Station"""
    try:
        raw = await client.get_union_departures()
        return transform.transform_union_departures(raw)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching Union departures: {str(e)}")

