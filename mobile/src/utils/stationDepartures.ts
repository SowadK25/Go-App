import type {
  JourneyStop,
  NextServiceLine,
  StationDeparture,
  TripStopDetails,
} from '../api/generated';
import { canonicalLineCode } from './transit';
import { timeDifference } from './stopTimes';

export function stationDeparturePrediction(departure: StationDeparture, live: NextServiceLine[]) {
  return live.find(
    (line) =>
      line.trip_number === departure.trip_number &&
      line.service_type === departure.service_type &&
      canonicalLineCode(line.line_code) === canonicalLineCode(departure.line_code) &&
      timeDifference(departure.scheduled_departure_time, line.scheduled_departure_time) === 0,
  );
}

export function clipReportedTripStops(stops: TripStopDetails[], scheduled: JourneyStop[]) {
  if (!scheduled.length) return stops;
  const start = stops.findIndex((stop) => stop.code === scheduled[0].code);
  if (start < 0) return [];
  const end = stops.findIndex(
    (stop, index) => index >= start && stop.code === scheduled[scheduled.length - 1].code,
  );
  return end >= start ? stops.slice(start, end + 1) : [];
}
