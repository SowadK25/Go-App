import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { transitApi } from '../api/transit';
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
  return useQuery({
    queryKey: ['lines'],
    queryFn: ({ signal }) => transitApi.lines(undefined, signal),
    staleTime: 300000,
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
