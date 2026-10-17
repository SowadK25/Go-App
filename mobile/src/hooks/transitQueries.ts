import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { transitApi } from '../api/transit';
import { torontoDateTime } from '../utils/transit';
export function useStops() {
  return useQuery({
    queryKey: ['stops'],
    queryFn: ({ signal }) => transitApi.stops(signal),
    staleTime: 86400000,
  });
}
export function useAlerts(stopCode?: string, enabled = true) {
  const focused = useIsFocused();
  return useQuery({
    queryKey: ['alerts', stopCode ?? 'all'],
    queryFn: ({ signal }) => transitApi.alerts({ stop_code: stopCode }, signal),
    staleTime: 60000,
    refetchInterval: 60000,
    enabled: enabled && focused,
    subscribed: enabled && focused,
  });
}
export function useLines() {
  const date = torontoDateTime().date;
  return useQuery({
    queryKey: ['lines', date],
    queryFn: ({ signal }) => transitApi.timetableLines(date, signal),
    staleTime: 86400000,
  });
}

export function useLineCatalog() {
  return useQuery({
    queryKey: ['lineCatalog'],
    queryFn: ({ signal }) => transitApi.lineCatalog(signal),
    staleTime: 86400000,
    retry: false,
  });
}
