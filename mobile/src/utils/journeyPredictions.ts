import type { JourneyService, JourneyStop, TripDetails } from '../api/generated';
import { stopTimes } from './stopTimes';

export type PredictedTime = { scheduled?: string | null; estimated?: string | null };

export function journeyStopTime(
  stop: JourneyStop,
  report: TripDetails | undefined,
  event: 'arrival' | 'departure' | 'auto' = 'auto',
): PredictedTime {
  const current = report?.stops?.find((item) => item.code === stop.code);
  if (!current) return { scheduled: stop.time };
  if (event === 'arrival' && (current.arrival_scheduled || current.arrival_computed)) {
    return {
      scheduled: stop.time || current.arrival_scheduled,
      estimated: current.arrival_computed,
    };
  }
  if (event === 'departure' && (current.departure_scheduled || current.departure_computed)) {
    return {
      scheduled: stop.time || current.departure_scheduled,
      estimated: current.departure_computed,
    };
  }
  if (event === 'auto') {
    const times = stopTimes(current);
    return { scheduled: stop.time || times.scheduled, estimated: times.estimated };
  }
  // An arrival estimate cannot be substituted for a departure, or vice versa.
  return { scheduled: stop.time };
}

export function journeyEndpoints(journey: JourneyService, reports: (TripDetails | undefined)[]) {
  const first = journey.trips?.[0];
  const last = journey.trips?.[journey.trips.length - 1];
  return {
    departure: first
      ? journeyStopTime(
          { code: first.depart_from_code, time: journey.start_time },
          reports[0],
          'departure',
        )
      : { scheduled: journey.start_time },
    arrival: last
      ? journeyStopTime(
          { code: last.destination_stop_code, time: journey.end_time },
          reports[reports.length - 1],
          'arrival',
        )
      : { scheduled: journey.end_time },
  };
}
