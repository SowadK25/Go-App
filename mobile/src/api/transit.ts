import { request } from './client';
import type { GetResponses } from './generated';

const code = encodeURIComponent;
function query(values: Record<string, string | number | undefined>): string {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return entries.length
    ? '?' + entries.map(([key, value]) => `${code(key)}=${code(String(value))}`).join('&')
    : '';
}

export const transitApi = {
  health: (signal?: AbortSignal) => request<GetResponses['/health']>('/health', signal),
  stops: (signal?: AbortSignal) => request<GetResponses['/api/stops']>('/api/stops', signal),
  stopDetails: (stop: string, signal?: AbortSignal) =>
    request<GetResponses['/api/stops/{stop_code}/details']>(
      `/api/stops/${code(stop)}/details`,
      signal,
    ),
  departures: (stop: string, signal?: AbortSignal) =>
    request<GetResponses['/api/stops/{stop_code}/next-service']>(
      `/api/stops/${code(stop)}/next-service`,
      signal,
    ),
  journeys: (
    from: string,
    to: string,
    date: string,
    time: string,
    maxJourneys = 5,
    signal?: AbortSignal,
  ) =>
    request<GetResponses['/api/journeys/{from_stop}/{to_stop}/{journey_date}/{start_time}']>(
      `/api/journeys/${code(from)}/${code(to)}/${code(date)}/${code(time)}${query({ max_journeys: maxJourneys })}`,
      signal,
    ),
  fares: (from: string, to: string, date?: string, signal?: AbortSignal) =>
    request<GetResponses['/api/fares/{from_stop}/{to_stop}']>(
      `/api/fares/${code(from)}/${code(to)}${query({ operational_day: date })}`,
      signal,
    ),
  lines: (date?: string, signal?: AbortSignal) =>
    request<GetResponses['/api/schedules/lines']>(
      `/api/schedules/lines${query({ schedule_date: date })}`,
      signal,
    ),
  lineStops: (line: string, direction: string, signal?: AbortSignal) =>
    request<GetResponses['/api/schedules/lines/{line_code}/{direction}/stops']>(
      `/api/schedules/lines/${code(line)}/${code(direction)}/stops`,
      signal,
    ),
  lineSchedule: (line: string, direction: string, date?: string, signal?: AbortSignal) =>
    request<GetResponses['/api/schedules/lines/{line_code}/{direction}']>(
      `/api/schedules/lines/${code(line)}/${code(direction)}${query({ schedule_date: date })}`,
      signal,
    ),
  unionDepartures: (signal?: AbortSignal) =>
    request<GetResponses['/api/service/union/departures']>('/api/service/union/departures', signal),
  alerts: (
    filters: { line_code?: string; stop_code?: string; trip_number?: string } = {},
    signal?: AbortSignal,
  ) => request<GetResponses['/api/alerts/all']>(`/api/alerts/all${query(filters)}`, signal),
};
