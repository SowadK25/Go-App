from fastapi import FastAPI
from app.routes import stops, journeys, alerts, schedules

app = FastAPI(
    title="GO Transit Unofficial API",
    version="1.0.0",
    description="Unofficial API for GO Transit information including trip planning, schedules, alerts, and real-time data"
)

# Include all routers
app.include_router(stops.router)
app.include_router(journeys.router)
app.include_router(alerts.router)
app.include_router(schedules.router)

@app.get("/health")
def health():
    return {"status": "ok"}
