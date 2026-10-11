import { useQueries } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { JourneyService } from '../api/generated';
import { transitApi } from '../api/transit';
import { torontoDateTime } from '../utils/transit';
import {
  legOccurrence,
  legLiveStatus,
  journeyLiveStatus,
  shouldRefreshLeg,
  type LiveMode,
} from '../utils/liveStatus';

const modes: LiveMode[] = ['train', 'bus'];

export function useJourneyStatuses(journeys: JourneyService[], enabled = true) {
  const focused = useIsFocused();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled || !focused) return;
    setNow(new Date());
    const tick = () => {
      if (Platform.OS === 'web' || AppState.currentState === 'active') setNow(new Date());
    };
    const timer = setInterval(tick, 60000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [enabled, focused]);
  const today = torontoDateTime(now).date;
  const needed = new Set(
    journeys.flatMap(
      (journey) =>
        journey.trips?.flatMap((_leg, index) =>
          shouldRefreshLeg(journey, index, now) ? [legOccurrence(journey, index)?.mode] : [],
        ) ?? [],
    ),
  );
  const live = useQueries({
    subscribed: enabled && focused,
    queries: modes.map((mode) => ({
      queryKey: ['liveService', mode, today],
      queryFn: ({ signal }: { signal: AbortSignal }) => transitApi.liveService(mode, signal),
      enabled: enabled && focused && needed.has(mode),
      staleTime: 60000,
      refetchInterval: 60000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });
  const exceptions = useQueries({
    subscribed: enabled && focused,
    queries: modes.map((mode) => ({
      queryKey: ['liveExceptions', mode, today],
      queryFn: ({ signal }: { signal: AbortSignal }) => transitApi.serviceExceptions(mode, signal),
      enabled: enabled && focused && needed.has(mode),
      staleTime: 120000,
      refetchInterval: 120000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });

  const legStatus = (journey: JourneyService, index: number) => {
    const occurrence = legOccurrence(journey, index);
    const modeIndex = modes.indexOf(occurrence?.mode as LiveMode);
    const service = live[modeIndex];
    const changes = exceptions[modeIndex];
    return legLiveStatus(
      journey,
      index,
      new Date(),
      service && !service.isError && service.fetchStatus !== 'paused'
        ? service.data?.trips
        : undefined,
      changes && !changes.isError && changes.fetchStatus !== 'paused' ? changes.data : undefined,
    );
  };
  return {
    refreshing:
      live.some((query) => query.isFetching) || exceptions.some((query) => query.isFetching),
    refresh: async () => {
      setNow(new Date());
      await Promise.all(
        modes.flatMap((mode, index) =>
          needed.has(mode) ? [live[index].refetch(), exceptions[index].refetch()] : [],
        ),
      );
    },
    legStatus,
    journeyStatus: (journey: JourneyService) =>
      journeyLiveStatus(journey.trips?.map((_leg, index) => legStatus(journey, index)) ?? []),
  };
}
