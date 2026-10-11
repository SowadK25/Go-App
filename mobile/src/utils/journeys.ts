import type { JourneyService, JourneyTrip } from '../api/generated';

export type JourneyFilter = 'all' | 'direct' | 'transfers';

export function transferCount(journey: JourneyService) {
  return journey.transfer_count ?? Math.max(0, (journey.trips?.length ?? 1) - 1);
}

export function filterJourneys(journeys: JourneyService[], filter: JourneyFilter) {
  return journeys
    .filter(
      (journey) =>
        filter === 'all' ||
        (filter === 'direct' ? transferCount(journey) === 0 : transferCount(journey) > 0),
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function legStops(leg: JourneyTrip) {
  const stops = [...(leg.stops ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const boarding = stops.findIndex((stop) => stop.code === leg.depart_from_code);
  const arrival = stops.findIndex((stop) => stop.code === leg.destination_stop_code);
  return boarding >= 0 && arrival >= boarding ? stops.slice(boarding, arrival + 1) : stops;
}
