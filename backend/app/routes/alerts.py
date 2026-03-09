import httpx
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.clients.metrolinx import MetrolinxClient
from app.models.alerts import Alert, ServiceException
from app import transformers as transform
from app.utils.utils import normalize_text

router = APIRouter(prefix="/api/alerts", tags=["alerts"])
client = MetrolinxClient()

def _filter_alerts(
    alerts: List[Alert],
    line_code: Optional[str],
    stop_code: Optional[str],
    trip_number: Optional[str],
    category: Optional[str],
    sub_category: Optional[str],
    status: Optional[str],
) -> List[Alert]:
    line_code_u = line_code.upper() if line_code else None
    stop_code_u = stop_code.upper() if stop_code else None
    trip_number_u = trip_number.upper() if trip_number else None
    category_l = normalize_text(category) if category else None
    sub_category_l = normalize_text(sub_category) if sub_category else None
    status_u = status.upper() if status else None

    filtered: List[Alert] = []
    for alert in alerts:
        if line_code_u and line_code_u not in [line.upper() for line in alert.affected_lines]:
            continue
        if stop_code_u and stop_code_u not in [stop.upper() for stop in alert.affected_stops]:
            continue
        if trip_number_u and trip_number_u not in [trip.upper() for trip in alert.affected_trips]:
            continue
        if category_l:
            alert_category = normalize_text(alert.category)
            if category_l not in alert_category and alert_category not in category_l:
                continue
        if sub_category_l:
            alert_sub_category = normalize_text(alert.sub_category)
            if sub_category_l not in alert_sub_category and alert_sub_category not in sub_category_l:
                continue
        if status_u and (alert.status or "").upper() != status_u:
            continue
        filtered.append(alert)
    filtered.sort(key=lambda a: a.posted_at or "", reverse=True)
    return filtered

@router.get("/service", response_model=List[Alert])
async def get_service_alerts(
    line_code: Optional[str] = Query(None),
    stop_code: Optional[str] = Query(None),
    trip_number: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    sub_category: Optional[str] = Query(None, alias="subcategory"),
    status: Optional[str] = Query(None, description="INIT or UPD"),
):
    """Get service alert messages"""
    try:
        raw = await client.get_service_alerts()
        alerts = transform.transform_alerts(raw, "Service")
        return _filter_alerts(alerts, line_code, stop_code, trip_number, category, sub_category, status)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching service alerts: {str(e)}")

@router.get("/information", response_model=List[Alert])
async def get_information_alerts(
    line_code: Optional[str] = Query(None),
    stop_code: Optional[str] = Query(None),
    trip_number: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    sub_category: Optional[str] = Query(None, alias="subcategory"),
    status: Optional[str] = Query(None, description="INIT or UPD"),
):
    """Get information alert messages"""
    try:
        raw = await client.get_information_alerts()
        alerts = transform.transform_alerts(raw, "Information")
        return _filter_alerts(alerts, line_code, stop_code, trip_number, category, sub_category, status)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching information alerts: {str(e)}")

@router.get("/all")
async def get_all_alerts(
    line_code: Optional[str] = Query(None),
    stop_code: Optional[str] = Query(None),
    trip_number: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    sub_category: Optional[str] = Query(None, alias="subcategory"),
    status: Optional[str] = Query(None, description="INIT or UPD"),
):
    """Get all alert types combined"""
    try:
        service_raw = await client.get_service_alerts()
        information_raw = await client.get_information_alerts()

        service_alerts = _filter_alerts(
            transform.transform_alerts(service_raw, "Service"),
            line_code, stop_code, trip_number, category, sub_category, status
        )
        info_alerts = _filter_alerts(
            transform.transform_alerts(information_raw, "Information"),
            line_code, stop_code, trip_number, category, sub_category, status
        )

        return {
            "service_alerts": service_alerts,
            "information_alerts": info_alerts
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
