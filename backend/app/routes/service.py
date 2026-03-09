import httpx
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.clients.metrolinx import MetrolinxClient
from app.models.service import (
    ServiceAtGlanceResponse,
    ServiceTrip,
    UnionDeparturesResponse,
    ServiceExceptionsResponse,
    ServiceExceptionTrip,
)
from app import transformers as transform
from app.utils.utils import normalize_text

router = APIRouter(prefix="/api/service", tags=["service"])
client = MetrolinxClient()


def _ensure_trip_found(trip_number: Optional[str], total: int) -> None:
    if trip_number and total == 0:
        raise HTTPException(status_code=404, detail=f"Trip {trip_number} not found")


def _ensure_stop_found(stop_code: Optional[str], total: int) -> None:
    if stop_code and total == 0:
        raise HTTPException(status_code=404, detail=f"Stop {stop_code} not found")


def _filter_service_trips(
    response: ServiceAtGlanceResponse,
    line_code: Optional[str],
    direction: Optional[str],
    trip_number: Optional[str],
    delay_status: Optional[str],
    limit: Optional[int],
) -> ServiceAtGlanceResponse:
    line_code_u = line_code.strip().upper() if line_code else None
    direction_u = direction.strip().upper() if direction else None
    trip_number_u = trip_number.strip().upper() if trip_number else None
    delay_status_n = normalize_text(delay_status) if delay_status else None

    filtered: list[ServiceTrip] = []
    for trip in response.trips:
        if line_code_u and (trip.line_code or "").upper() != line_code_u:
            continue
        if direction_u and (trip.direction or "").upper() != direction_u:
            continue
        if trip_number_u and (trip.trip_number or "").upper() != trip_number_u:
            continue
        if delay_status_n and normalize_text(trip.delay_status) != delay_status_n:
            continue
        filtered.append(trip)

    if limit is not None:
        filtered = filtered[:limit]

    return ServiceAtGlanceResponse(
        mode=response.mode,
        total_trips=len(filtered),
        in_motion_trips=sum(1 for trip in filtered if trip.is_in_motion),
        early_trips=sum(1 for trip in filtered if trip.delay_status == "early"),
        on_time_trips=sum(1 for trip in filtered if trip.delay_status == "on_time"),
        delayed_trips=sum(1 for trip in filtered if trip.delay_status == "delayed"),
        trips=filtered,
    )


def _filter_exception_trips(
    response: ServiceExceptionsResponse,
    exception_type: Optional[str],
    trip_number: Optional[str],
    stop_code: Optional[str],
    limit: Optional[int],
) -> ServiceExceptionsResponse:
    exception_type_n = normalize_text(exception_type) if exception_type else None
    trip_number_u = trip_number.strip().upper() if trip_number else None
    stop_code_u = stop_code.strip().upper() if stop_code else None

    filtered: list[ServiceExceptionTrip] = []
    for trip in response.trips:
        if exception_type_n and normalize_text(trip.exception_type) != exception_type_n:
            continue
        if trip_number_u and (trip.trip_number or "").upper() != trip_number_u:
            continue
        if stop_code_u:
            stop_codes = [(stop.code or "").upper() for stop in trip.affected_stops]
            if stop_code_u not in stop_codes:
                continue
        filtered.append(trip)

    if limit is not None:
        filtered = filtered[:limit]

    return ServiceExceptionsResponse(
        mode=response.mode,
        generated_at=response.generated_at,
        total_trips=len(filtered),
        cancelled_trips=sum(1 for trip in filtered if trip.exception_type == "cancelled"),
        override_trips=sum(1 for trip in filtered if trip.exception_type == "override"),
        stop_change_trips=sum(1 for trip in filtered if trip.exception_type == "stop_change"),
        trips=filtered,
    )


@router.get("/trains", response_model=ServiceAtGlanceResponse, response_model_exclude_none=True)
async def get_service_trains(
    line_code: Optional[str] = Query(None),
    direction: Optional[str] = Query(None, description="N/S/E/W"),
    trip_number: Optional[str] = Query(None),
    delay_status: Optional[str] = Query(None, description="early, on_time, delayed"),
    limit: Optional[int] = Query(None, ge=1, le=200),
):
    """Get all currently in-service trains."""
    try:
        raw = await client.get_service_trains()
        response = transform.transform_service_at_a_glance(raw, mode="train")
        filtered = _filter_service_trips(
            response=response,
            line_code=line_code,
            direction=direction,
            trip_number=trip_number,
            delay_status=delay_status,
            limit=limit,
        )
        _ensure_trip_found(trip_number, filtered.total_trips)
        return filtered
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching train service status: {str(e)}")


@router.get("/buses", response_model=ServiceAtGlanceResponse, response_model_exclude_none=True)
async def get_service_buses(
    line_code: Optional[str] = Query(None),
    direction: Optional[str] = Query(None, description="N/S/E/W"),
    trip_number: Optional[str] = Query(None),
    delay_status: Optional[str] = Query(None, description="early, on_time, delayed"),
    limit: Optional[int] = Query(None, ge=1, le=200),
):
    """Get all currently in-service buses."""
    try:
        raw = await client.get_service_buses()
        response = transform.transform_service_at_a_glance(raw, mode="bus")
        filtered = _filter_service_trips(
            response=response,
            line_code=line_code,
            direction=direction,
            trip_number=trip_number,
            delay_status=delay_status,
            limit=limit,
        )
        _ensure_trip_found(trip_number, filtered.total_trips)
        return filtered
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching bus service status: {str(e)}")

@router.get("/union/departures", response_model=UnionDeparturesResponse)
async def get_union_departures(
    service: Optional[str] = Query(None, description="Service name, e.g. 'Lakeshore West'"),
    service_type: Optional[str] = Query(None, description="Service type code, e.g. T or B"),
    boarding_status: Optional[str] = Query(None, description="proceed or wait"),
    destination: Optional[str] = Query(None, description="Destination stop name contains filter"),
    limit: Optional[int] = Query(None, ge=1, le=100, description="Max number of departures"),
):
    """Get nearest departures from Union Station"""
    try:
        raw = await client.get_union_departures()
        response = transform.transform_union_departures(raw)

        service_filter = normalize_text(service) if service else None
        service_type_filter = service_type.strip().upper() if service_type else None
        boarding_status_filter = normalize_text(boarding_status) if boarding_status else None
        destination_filter = normalize_text(destination) if destination else None

        departures = response.departures

        if service_filter:
            departures = [
                dep for dep in departures
                if service_filter in normalize_text(dep.service)
            ]
        if service_type_filter:
            departures = [
                dep for dep in departures
                if (dep.service_type or "").upper() == service_type_filter
            ]
        if boarding_status_filter:
            departures = [
                dep for dep in departures
                if normalize_text(dep.boarding_status) == boarding_status_filter
            ]
        if destination_filter:
            departures = [
                dep for dep in departures
                if destination_filter in normalize_text(dep.destination)
            ]
        if limit is not None:
            departures = departures[:limit]

        return UnionDeparturesResponse(
            generated_at=response.generated_at,
            total_departures=len(departures),
            departures=departures,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching Union departures: {str(e)}")


@router.get("/exceptions/train", response_model=ServiceExceptionsResponse)
async def get_service_exceptions_train(
    exception_type: Optional[str] = Query(None, description="cancelled, override, stop_change"),
    trip_number: Optional[str] = Query(None),
    stop_code: Optional[str] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=500),
):
    """Get current train service exceptions."""
    try:
        raw = await client.get_exceptions_train()
        response = transform.transform_service_exceptions(raw, mode="train")
        filtered = _filter_exception_trips(response, exception_type, trip_number, stop_code, limit)
        _ensure_trip_found(trip_number, filtered.total_trips)
        _ensure_stop_found(stop_code, filtered.total_trips)
        return filtered
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching train exceptions: {str(e)}")


@router.get("/exceptions/bus", response_model=ServiceExceptionsResponse)
async def get_service_exceptions_bus(
    exception_type: Optional[str] = Query(None, description="cancelled, override, stop_change"),
    trip_number: Optional[str] = Query(None),
    stop_code: Optional[str] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=500),
):
    """Get current bus service exceptions."""
    try:
        raw = await client.get_exceptions_bus()
        response = transform.transform_service_exceptions(raw, mode="bus")
        filtered = _filter_exception_trips(response, exception_type, trip_number, stop_code, limit)
        _ensure_trip_found(trip_number, filtered.total_trips)
        _ensure_stop_found(stop_code, filtered.total_trips)
        return filtered
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching bus exceptions: {str(e)}")


@router.get("/exceptions/all", response_model=ServiceExceptionsResponse)
async def get_service_exceptions_all(
    exception_type: Optional[str] = Query(None, description="cancelled, override, stop_change"),
    trip_number: Optional[str] = Query(None),
    stop_code: Optional[str] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=500),
):
    """Get all current service exceptions."""
    try:
        raw = await client.get_exceptions_all()
        response = transform.transform_service_exceptions(raw, mode="all")
        filtered = _filter_exception_trips(response, exception_type, trip_number, stop_code, limit)
        _ensure_trip_found(trip_number, filtered.total_trips)
        _ensure_stop_found(stop_code, filtered.total_trips)
        return filtered
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching all exceptions: {str(e)}")
