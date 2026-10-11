import type { JourneyService, JourneyTrip } from '../api/generated';
import { torontoDateTime } from './transit';

export type JourneyFilter = 'all' | 'direct' | 'transfers';
export type JourneySearchMode = 'depart_at' | 'arrive_by';

function scheduledMillis(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  return match
    ? Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +(match[6] ?? 0))
    : NaN;
}

function arrivalTargetMillis(date: string, time: string) {
  return scheduledMillis(
    `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)} ${time.slice(0, 2)}:${time.slice(2)}:00`,
  );
}

export function arrivalMinutesAfterTarget(journey: JourneyService, date: string, time: string) {
  return Math.max(
    0,
    Math.ceil((scheduledMillis(journey.end_time) - arrivalTargetMillis(date, time)) / 60000),
  );
}

export function upcomingArriveByJourneys(
  journeys: JourneyService[],
  date: string,
  time: string,
  now: Date,
) {
  const current = torontoDateTime(now);
  const timestamp = (day: string, clock: string) =>
    `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)} ${clock.slice(0, 2)}:${clock.slice(2)}:00`;
  const deadline = arrivalTargetMillis(date, time);
  const earliest = deadline - 60 * 60000;
  const latest = deadline + 30 * 60000;
  const currentTime =
    scheduledMillis(timestamp(current.date, current.time)) +
    now.getUTCSeconds() * 1000 +
    now.getUTCMilliseconds();
  return journeys.filter((journey) => {
    const arrival = scheduledMillis(journey.end_time);
    return (
      scheduledMillis(journey.start_time) >= currentTime && arrival >= earliest && arrival <= latest
    );
  });
}

export function transferCount(journey: JourneyService) {
  return journey.transfer_count ?? Math.max(0, (journey.trips?.length ?? 1) - 1);
}

export function filterJourneys(
  journeys: JourneyService[],
  filter: JourneyFilter,
  mode: JourneySearchMode = 'depart_at',
) {
  return journeys
    .filter(
      (journey) =>
        filter === 'all' ||
        (filter === 'direct' ? transferCount(journey) === 0 : transferCount(journey) > 0),
    )
    .sort((a, b) =>
      mode === 'arrive_by'
        ? b.start_time.localeCompare(a.start_time) || a.end_time.localeCompare(b.end_time)
        : a.start_time.localeCompare(b.start_time),
    );
}

export function legStops(leg: JourneyTrip) {
  const stops = [...(leg.stops ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const boarding = stops.findIndex((stop) => stop.code === leg.depart_from_code);
  const arrival = stops.findIndex((stop) => stop.code === leg.destination_stop_code);
  return boarding >= 0 && arrival >= boarding ? stops.slice(boarding, arrival + 1) : stops;
}
