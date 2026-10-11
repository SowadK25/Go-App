import type { JourneyService, Stop } from '../api/generated';
import { torontoDateTime } from '../utils/transit';

export type SavedStop = Pick<Stop, 'id' | 'name' | 'type'>;
export type TrackedTrip = {
  journey: JourneyService;
  fromName: string;
  toName: string;
  date: string;
};
export type Preferences = {
  favorites: SavedStop[];
  home: SavedStop | null;
  work: SavedStop | null;
  trackedTrip: TrackedTrip | null;
};

export const isStop = (value: unknown): value is SavedStop => {
  if (!value || typeof value !== 'object') return false;
  const stop = value as SavedStop;
  return ['id', 'name', 'type'].every((key) => typeof stop[key as keyof SavedStop] === 'string');
};

function wallMinute(value: string) {
  const match = value.match(/^(\d{4})-?(\d{2})-?(\d{2})[ T](\d{2}):?(\d{2})/);
  if (!match) return NaN;
  return Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]) / 60000;
}

export function isTrackedTrip(value: unknown): value is TrackedTrip {
  if (!value || typeof value !== 'object') return false;
  const trip = value as TrackedTrip;
  const journey = trip.journey;
  return (
    typeof trip.fromName === 'string' &&
    typeof trip.toName === 'string' &&
    typeof trip.date === 'string' &&
    /^\d{8}$/.test(trip.date) &&
    !!journey &&
    typeof journey.start_time === 'string' &&
    typeof journey.end_time === 'string' &&
    Number.isFinite(wallMinute(journey.start_time)) &&
    Number.isFinite(wallMinute(journey.end_time)) &&
    journey.start_time.slice(0, 10).replace(/-/g, '') === trip.date &&
    Array.isArray(journey.trips) &&
    journey.trips.length > 0 &&
    journey.trips.every(
      (leg) =>
        !!leg &&
        [
          'number',
          'display',
          'line',
          'direction',
          'vehicle_type',
          'depart_from_code',
          'destination_stop_code',
        ].every((key) => typeof leg[key as keyof typeof leg] === 'string') &&
        (leg.stops === undefined ||
          (Array.isArray(leg.stops) &&
            leg.stops.every(
              (stop) =>
                !!stop &&
                typeof stop.code === 'string' &&
                (stop.time == null || typeof stop.time === 'string'),
            ))),
    )
  );
}

export function trackedTripKey(trip: TrackedTrip) {
  return JSON.stringify([
    trip.date,
    trip.journey.start_time,
    trip.journey.end_time,
    trip.journey.trips?.map((leg) => [leg.number, leg.depart_from_code, leg.destination_stop_code]),
  ]);
}

// Keep delayed journeys accessible for two hours after their scheduled arrival.
export function trackingExpired(trip: TrackedTrip, now = new Date()) {
  const current = torontoDateTime(now);
  return wallMinute(`${current.date} ${current.time}`) > wallMinute(trip.journey.end_time) + 120;
}

export function readPreferences(value: unknown, now = new Date()): Preferences {
  const data = value && typeof value === 'object' ? (value as Partial<Preferences>) : {};
  return {
    favorites: Array.isArray(data.favorites) ? data.favorites.filter(isStop) : [],
    home: isStop(data.home) ? data.home : null,
    work: isStop(data.work) ? data.work : null,
    trackedTrip:
      isTrackedTrip(data.trackedTrip) && !trackingExpired(data.trackedTrip, now)
        ? data.trackedTrip
        : null,
  };
}
