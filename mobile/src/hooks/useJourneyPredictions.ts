import { useQueries } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import type { JourneyService } from '../api/generated';
import { transitApi } from '../api/transit';
import { legOccurrence, shouldRefreshLeg, isFreshLiveTimestamp } from '../utils/liveStatus';

export function useJourneyPredictions(
  journeys: JourneyService[],
  fetchPredictions = false,
  enabled = true,
) {
  const focused = useIsFocused();
  const now = new Date();
  const specs = new Map<string, { number: string; date: string; eligible: boolean }>();
  for (const journey of journeys)
    journey.trips?.forEach((leg, index) => {
      const occurrence = legOccurrence(journey, index);
      if (occurrence && leg.number) {
        const key = `${occurrence.date}:${leg.number}`;
        specs.set(key, {
          number: leg.number,
          date: occurrence.date,
          eligible: (specs.get(key)?.eligible ?? false) || shouldRefreshLeg(journey, index, now),
        });
      }
    });
  const requests = [...specs.entries()];
  const queries = useQueries({
    subscribed: enabled && focused,
    queries: requests.map(([, spec]) => ({
      queryKey: ['tripSchedule', spec.number, spec.date],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        transitApi.tripSchedule(spec.number, spec.date, signal),
      enabled: fetchPredictions && enabled && focused && spec.eligible,
      staleTime: 60000,
      refetchInterval: fetchPredictions && spec.eligible ? 60000 : false,
      refetchOnMount: fetchPredictions,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });

  const trip = (journey: JourneyService, index: number) => {
    const leg = journey.trips?.[index];
    const occurrence = legOccurrence(journey, index);
    if (!leg || !occurrence || !shouldRefreshLeg(journey, index, new Date())) return undefined;
    const requestIndex = requests.findIndex(([key]) => key === `${occurrence.date}:${leg.number}`);
    const query = queries[requestIndex];
    if (
      !query ||
      query.isError ||
      query.fetchStatus === 'paused' ||
      Date.now() - query.dataUpdatedAt > 120000 ||
      query.data?.date.replace(/-/g, '') !== occurrence.date
    )
      return undefined;
    const report = query.data.trips?.find((item) => item.trip_number === leg.number);
    return report?.timestamp && !isFreshLiveTimestamp(report.timestamp, new Date())
      ? undefined
      : report;
  };
  return {
    trip,
    refreshing: fetchPredictions && queries.some((query) => query.isFetching),
    refresh: async () => {
      if (!fetchPredictions || !enabled || !focused) return;
      await Promise.all(
        queries.flatMap((query, index) => (requests[index][1].eligible ? [query.refetch()] : [])),
      );
    },
  };
}
