import httpx
from datetime import date
from typing import Optional
from app.config import METROLINX_API_KEY

BASE_URL = "https://api.openmetrolinx.com/OpenDataAPI/api/V1"

class MetrolinxClient:
    def __init__(self):
        self.timeout = 10
    
    async def _get(self, endpoint: str, params: Optional[dict] = None):
        """Helper method for GET requests"""
        if params is None:
            params = {}
        params["key"] = METROLINX_API_KEY
        
        async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
            response = await client.get(f"{BASE_URL}/{endpoint}", params=params)
            response.raise_for_status()
            return response.json()
    
    # ========== Stop Methods ==========
    
    async def get_stops_all(self):
        """Returns all stops/stations"""
        return await self._get("Stop/All")
    
    async def get_stop_next_service(self, stop_code: str):
        """Returns predictions for all lines that feed a stop"""
        return await self._get(f"Stop/NextService/{stop_code}")
    
    async def get_stop_details(self, stop_code: str):
        """Returns detailed stop information"""
        return await self._get(f"Stop/Details/{stop_code}")
    
    async def get_stop_destinations(self, stop_code: str, from_time: str, to_time: str):
        """Returns destinations available from a stop within a time range"""
        return await self._get(f"Stop/Destinations/{stop_code}/{from_time}/{to_time}")
    
    # ========== Journey & Schedule Methods ==========
    
    async def get_journey(
        self, 
        from_stop_code: str, 
        to_stop_code: str, 
        date: str, 
        start_time: str, 
        max_journeys: int = 5
    ):
        """Returns journey options between two stops"""
        return await self._get(
            f"Schedule/Journey/{date}/{from_stop_code}/{to_stop_code}/{start_time}/{max_journeys}"
        )
    
    async def get_lines_all(self, date: str):
        """Returns all lines in effect for a date"""
        return await self._get(f"Schedule/Line/All/{date}")
    
    async def get_line_schedule(self, date: str, line_code: str, line_direction: str):
        """Returns line schedule details"""
        return await self._get(f"Schedule/Line/{date}/{line_code}/{line_direction}")
    
    async def get_line_stops(self, date: str, line_code: str, line_direction: str):
        """Returns stops for a line and direction"""
        return await self._get(f"Schedule/Line/Stop/{date}/{line_code}/{line_direction}")
    
    async def get_trip_schedule(self, date: str, trip_number: str):
        """Returns trip details with all stops"""
        return await self._get(f"Schedule/Trip/{date}/{trip_number}")
    
    # ========== Fare Methods ==========
    
    async def get_fares(self, from_stop_code: str, to_stop_code: str, operational_day: Optional[str] = None):
        """Returns fare information between two stops"""
        if operational_day:
            return await self._get(f"Fares/{from_stop_code}/{to_stop_code}/{operational_day}")
        return await self._get(f"Fares/{from_stop_code}/{to_stop_code}")
    
    # ========== Service Update & Alert Methods ==========
    
    async def get_service_alerts(self):
        """Returns service alert messages"""
        return await self._get("ServiceUpdate/ServiceAlert/All")
    
    async def get_information_alerts(self):
        """Returns information alert messages"""
        return await self._get("ServiceUpdate/InformationAlert/All")
    
    async def get_union_departures(self):
        """Returns nearest departures from Union Station"""
        return await self._get("ServiceUpdate/UnionDepartures/All")
    
    async def get_exceptions_train(self):
        """Returns train schedule exceptions (cancellations, etc.)"""
        return await self._get("ServiceUpdate/Exceptions/Train")
    
    async def get_exceptions_bus(self):
        """Returns bus schedule exceptions"""
        return await self._get("ServiceUpdate/Exceptions/Bus")
    
    async def get_exceptions_all(self):
        """Returns all schedule exceptions"""
        return await self._get("ServiceUpdate/Exceptions/All")
    
    # ========== Service Status Methods ==========
    
    async def get_service_buses(self):
        """Returns all in-service bus trips"""
        return await self._get("ServiceataGlance/Buses/All")
    
    async def get_service_trains(self):
        """Returns all in-service train trips"""
        return await self._get("ServiceataGlance/Trains/All")
    
    async def get_service_upx(self):
        """Returns all in-service UPX trips"""
        return await self._get("ServiceataGlance/UPX/All")
    
    # ========== GTFS Real-time Methods ==========
    
    async def get_gtfs_alerts(self):
        """Returns GTFS real-time alert feeds"""
        return await self._get("Gtfs/Feed/Alerts")
    
    async def get_gtfs_trip_updates(self):
        """Returns GTFS real-time trip update feeds"""
        return await self._get("Gtfs/Feed/TripUpdates")
    
    async def get_gtfs_vehicle_positions(self):
        """Returns GTFS real-time vehicle position feeds"""
        return await self._get("Gtfs/Feed/VehiclePosition")
