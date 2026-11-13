import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { transitApi } from '../api/transit';
import type { NetworkMap } from '../api/generated';
import { useCurrentTime } from './useCurrentTime';
import { recentTrainPosition, type MapFilter } from '../components/map/mapTypes';
import { visibleMapLines } from '../utils/networkMap';

export function useMapTrains(network: NetworkMap | undefined, filter: MapFilter, enabled: boolean) {
  const focused = useIsFocused();
  const now = useCurrentTime(enabled, 15000);
  const lines = useMemo(
    () =>
      new Set(
        network
          ? visibleMapLines(network, filter)
              .filter((line) => line.vehicle_type === 'Train' && line.code !== 'UP')
              .map((line) => line.code)
          : [],
      ),
    [network, filter],
  );
  const active = enabled && focused && lines.size > 0;
  const query = useQuery({
    queryKey: ['mapTrainPositions'],
    queryFn: ({ signal }) => transitApi.trainPositions(signal),
    enabled: active,
    subscribed: active,
    staleTime: 300000,
    refetchInterval: 300000,
    retry: false,
  });
  const trains = useMemo(
    () =>
      !active || query.isError || query.fetchStatus === 'paused' || !query.data?.available
        ? []
        : (query.data.trains ?? []).filter(
            (train) => lines.has(train.line_code) && recentTrainPosition(train, now.getTime()),
          ),
    [active, query.isError, query.fetchStatus, query.data, lines, now],
  );
  const reportsExpired =
    active &&
    query.data?.trains?.some(
      (train) =>
        lines.has(train.line_code) && now.getTime() - Date.parse(train.updated_at) > 180000,
    );
  return { ...query, trains, reportsExpired, hasVisibleLines: lines.size > 0 };
}
