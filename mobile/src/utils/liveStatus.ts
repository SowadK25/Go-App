import type { JourneyService, ServiceTrip, ServiceExceptionsResponse } from '../api/generated';
import { canonicalLineCode, torontoDateTime } from './transit';

export type LiveTripStatus = {
  kind: 'scheduled' | 'on_time' | 'early' | 'delayed' | 'cancelled' | 'unavailable';
  label: string;
  tone: 'neutral' | 'success' | 'danger';
  delayMinutes?: number;
};
export type LiveMode = 'train' | 'bus' | 'up';
const unavailable: LiveTripStatus = {
  kind: 'unavailable',
  label: 'Status unavailable',
  tone: 'neutral',
};
const scheduled: LiveTripStatus = { kind: 'scheduled', label: 'Scheduled', tone: 'neutral' };

function timeParts(value?: string | null) {
  const match = value?.match(/(?:(\d{4})-(\d{2})-(\d{2})[ T])?(\d{2}):(\d{2})/);
  if (!match) return null;
  return {
    date: match[1] ? `${match[1]}${match[2]}${match[3]}` : null,
    minutes: (Number(match[4]) % 24) * 60 + Number(match[5]),
  };
}

function localMinutes(date: string, minutes: number) {
  return (
    Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(4, 6)) - 1,
      Number(date.slice(6)),
      0,
      minutes,
    ) / 60000
  );
}

export function legOccurrence(journey: JourneyService, index: number) {
  const leg = journey.trips?.[index];
  const start = timeParts(journey.start_time);
  const boarding =
    timeParts(leg?.stops?.find((stop) => stop.code === leg.depart_from_code)?.time) ??
    (index === 0 ? start : null);
  if (!leg || !start?.date || !boarding) return null;
  const minute =
    localMinutes(boarding.date ?? start.date, boarding.minutes) +
    (!boarding.date && start.minutes - boarding.minutes > 720 ? 1440 : 0);
  const date = new Date(minute * 60000).toISOString().slice(0, 10).replace(/-/g, '');
  return {
    date,
    minute,
    mode:
      canonicalLineCode(leg.line) === 'UP'
        ? ('up' as const)
        : leg.vehicle_type === 'T'
          ? ('train' as const)
          : leg.vehicle_type === 'B'
            ? ('bus' as const)
            : null,
  };
}

export function shouldRefreshLeg(journey: JourneyService, index: number, now: Date) {
  const occurrence = legOccurrence(journey, index);
  const current = torontoDateTime(now);
  if (!occurrence?.mode || occurrence.date !== current.date) return false;
  const currentMinute = localMinutes(
    current.date,
    Number(current.time.slice(0, 2)) * 60 + Number(current.time.slice(2)),
  );
  const leg = journey.trips?.[index];
  const arrival =
    timeParts(leg?.stops?.find((stop) => stop.code === leg.destination_stop_code)?.time) ??
    timeParts(journey.end_time);
  if (!arrival)
    return currentMinute >= occurrence.minute - 30 && currentMinute <= occurrence.minute + 240;
  let arrivalMinute = localMinutes(arrival.date ?? occurrence.date, arrival.minutes);
  if (!arrival.date && arrivalMinute < occurrence.minute) arrivalMinute += 1440;
  // Fetch near departure/in progress, with a buffer for delayed services.
  return currentMinute >= occurrence.minute - 30 && currentMinute <= arrivalMinute + 90;
}

function freshTimestamp(value: string | null | undefined, today: string, nowMinutes: number) {
  const timestamp = timeParts(value);
  if (!timestamp || timestamp.date !== today) return false;
  const age = nowMinutes - localMinutes(timestamp.date, timestamp.minutes);
  return age >= -1 && age <= 5;
}

export function isFreshLiveTimestamp(value: string | null | undefined, now: Date) {
  const current = torontoDateTime(now);
  return freshTimestamp(
    value,
    current.date,
    localMinutes(
      current.date,
      Number(current.time.slice(0, 2)) * 60 + Number(current.time.slice(2)),
    ),
  );
}

export function legLiveStatus(
  journey: JourneyService,
  index: number,
  now: Date,
  trips?: ServiceTrip[],
  exceptions?: ServiceExceptionsResponse,
): LiveTripStatus {
  const leg = journey.trips?.[index];
  const occurrence = legOccurrence(journey, index);
  const current = torontoDateTime(now);
  const nowMinutes = localMinutes(
    current.date,
    Number(current.time.slice(0, 2)) * 60 + Number(current.time.slice(2)),
  );
  if (!leg || !occurrence) return unavailable;
  if (occurrence.date > current.date) return scheduled;
  if (occurrence.date !== current.date || !occurrence.mode) return unavailable;

  if (exceptions && freshTimestamp(exceptions.generated_at, current.date, nowMinutes)) {
    const cancelled = exceptions.trips?.find(
      (item) =>
        item.trip_number === leg.number &&
        item.is_cancelled &&
        (!item.service_date || item.service_date === (leg.service_date ?? occurrence.date)),
    );
    if (cancelled) {
      const datedStops =
        cancelled.affected_stops
          ?.flatMap((stop) => [
            timeParts(stop.scheduled_departure)?.date,
            timeParts(stop.scheduled_arrival)?.date,
          ])
          .filter(Boolean) ?? [];
      if (!datedStops.length || datedStops.includes(occurrence.date))
        return { kind: 'cancelled', label: 'Cancelled', tone: 'danger' };
    }
  }
  const active = trips?.find(
    (trip) =>
      trip.trip_number === leg.number &&
      (!trip.service_date || trip.service_date === (leg.service_date ?? occurrence.date)) &&
      [trip.line_code, trip.route_number ?? ''].some(
        (code) => canonicalLineCode(code) === canonicalLineCode(leg.line),
      ) &&
      freshTimestamp(trip.modified_at, current.date, nowMinutes),
  );
  if (active?.delay_status === 'delayed' || active?.delay_status === 'early') {
    const minutes =
      active.delay_minutes ??
      (active.delay_seconds != null ? Math.round(active.delay_seconds / 60) : undefined);
    return {
      kind: active.delay_status,
      label: `${active.delay_status === 'delayed' ? 'Delayed' : 'Early'}${minutes != null ? ` - ${Math.abs(minutes)} min` : ''}`,
      tone: active.delay_status === 'delayed' ? 'danger' : 'success',
      delayMinutes: minutes,
    };
  }
  if (active?.delay_status === 'on_time')
    return { kind: 'on_time', label: 'On time', tone: 'success' };
  return occurrence.minute > nowMinutes ? scheduled : unavailable;
}

export function journeyLiveStatus(statuses: LiveTripStatus[]): LiveTripStatus {
  return (
    statuses.find((status) => status.kind === 'cancelled') ??
    [...statuses]
      .filter((status) => status.kind === 'delayed')
      .sort((a, b) => (b.delayMinutes ?? 0) - (a.delayMinutes ?? 0))[0] ??
    statuses.find((status) => status.kind === 'unavailable') ??
    statuses.find((status) => status.kind === 'scheduled') ??
    (statuses.length === 1
      ? statuses[0]
      : statuses.length
        ? { kind: 'on_time', label: 'On time', tone: 'success' }
        : unavailable)
  );
}
