import type { TripStopDetails } from '../api/generated';

export function stopTimes(stop: TripStopDetails) {
  // Compare the same event: departure when available, otherwise arrival.
  return stop.departure_scheduled || stop.departure_computed
    ? { scheduled: stop.departure_scheduled, estimated: stop.departure_computed }
    : { scheduled: stop.arrival_scheduled, estimated: stop.arrival_computed };
}

function parseTime(value: string) {
  const match = value.match(/(?:(\d{4})-(\d{2})-(\d{2})[ T])?(\d{2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[4]);
  const minutes = hours * 60 + Number(match[5]);
  const datedMinutes = match[1]
    ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hours, Number(match[5])) /
      60000
    : null;
  return { minutes, hours, datedMinutes };
}

export function timeDifference(scheduled?: string | null, estimated?: string | null) {
  if (!scheduled || !estimated) return null;
  const original = parseTime(scheduled);
  const updated = parseTime(estimated);
  if (!original || !updated) return null;
  if (original.datedMinutes !== null && updated.datedMinutes !== null) {
    return updated.datedMinutes - original.datedMinutes;
  }
  let difference = updated.minutes - original.minutes;
  // Time-only predictions around midnight belong to the nearest service day.
  if (original.hours < 24 && updated.hours < 24) {
    if (difference < -720) difference += 1440;
    if (difference > 720) difference -= 1440;
  }
  return difference;
}
