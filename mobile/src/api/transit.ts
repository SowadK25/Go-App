import { request } from './client';
import type { GetResponses } from './generated';
import type { JourneySearchMode } from '../utils/journeys';

const code = encodeURIComponent;
function query(values: Record<string, string | number | undefined>): string {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return entries.length
    ? '?' + entries.map(([key, value]) => `${code(key)}=${code(String(value))}`).join('&')
    : '';
}

export const transitApi = {
  lineCatalog: (signal?: AbortSignal) =>
    request<GetResponses['/api/map/lines']>('/api/map/lines', signal, 45000),
  timetableLines: (date: string, signal?: AbortSignal) =>
    request<GetResponses['/api/map/schedules/lines']>(
      `/api/map/schedules/lines${query({ schedule_date: date })}`,
      signal,
      45000,
    ),
  lineTimetable: (line: string, direction: string, date: string, signal?: AbortSignal) =>
    request<GetResponses['/api/map/schedules/lines/{line_code}/{direction}']>(
      `/api/map/schedules/lines/${code(line)}/${code(direction)}${query({ schedule_date: date })}`,
      signal,
      45000,
    ),
  stationDepartures: (stop: string, date: string, signal?: AbortSignal) =>
    request<GetResponses['/api/stops/{stop_code}/departures']>(
      `/api/stops/${code(stop)}/departures${query({ schedule_date: date })}`,
      signal,
      45000,
    ),
  lineStations: (line: string, signal?: AbortSignal) =>
    request<GetResponses['/api/map/lines/{line_code}/stops']>(
      `/api/map/lines/${code(line)}/stops`,
      signal,
      45000,
    ),
  networkMap: (signal?: AbortSignal) =>
    request<GetResponses['/api/map/network']>('/api/map/network', signal, 45000),
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
    searchMode: JourneySearchMode = 'depart_at',
  ) =>
    request<GetResponses['/api/journeys/{from_stop}/{to_stop}/{journey_date}/{start_time}']>(
      `/api/journeys/${code(from)}/${code(to)}/${code(date)}/${code(time)}${query({ max_journeys: maxJourneys, search_mode: searchMode })}`,
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
  liveService: (mode: 'train' | 'bus', signal?: AbortSignal) =>
    request<GetResponses['/api/service/trains']>(
      `/api/service/${mode === 'train' ? 'trains' : 'buses'}`,
      signal,
    ),
  serviceExceptions: (mode: 'train' | 'bus', signal?: AbortSignal) =>
    request<GetResponses['/api/service/exceptions/train']>(
      `/api/service/exceptions/${mode}`,
      signal,
    ),
  tripSchedule: (tripNumber: string, date: string, signal?: AbortSignal) =>
    request<GetResponses['/api/schedules/trips/{trip_number}']>(
      `/api/schedules/trips/${code(tripNumber)}${query({ schedule_date: date })}`,
      signal,
    ),
  alerts: (
    filters: { line_code?: string; stop_code?: string; trip_number?: string } = {},
    signal?: AbortSignal,
  ) => request<GetResponses['/api/alerts/all']>(`/api/alerts/all${query(filters)}`, signal),
};
