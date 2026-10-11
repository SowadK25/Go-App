import { RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import { transitApi } from '../api/transit';
import { useStops } from '../hooks/transitQueries';
import { serviceTimestamp, serviceDate } from '../utils/transit';
import { stopTimes } from '../utils/stopTimes';
import { StopTime } from '../components/transit/StopTime';
import { Screen } from '../components/layout/Screen';
import { Card } from '../components/ui/Card';
import { LineBadge } from '../components/ui/LineBadge';
import { SectionHeading } from '../components/ui/SectionHeading';
import { RequestState } from '../components/RequestState';
import { StopTimeline } from '../components/transit/StopTimeline';
import { styles } from './screens.styles';

export function ScheduleTripDetailsScreen({
  route,
}: NativeStackScreenProps<RootStackParams, 'ScheduleTripDetails'>) {
  const { tripNumber, title, date, lineCode, scheduledStops = [] } = route.params;
  const focused = useIsFocused();
  const stations = useStops();
  const stopName = (code: string) => stations.data?.find((stop) => stop.id === code)?.name ?? code;
  const details = useQuery({
    queryKey: ['tripSchedule', tripNumber, date],
    queryFn: ({ signal }) => transitApi.tripSchedule(tripNumber, date, signal),
    staleTime: 60000,
    refetchInterval: 60000,
    subscribed: focused,
  });
  const trip = details.data?.trips?.find((item) => item.trip_number === tripNumber);
  const reportedStops = trip?.stops ?? [];
  const timeline = reportedStops.length
    ? reportedStops.map((stop, index) => ({
        code: stop.code,
        order: index + 1,
        time: stopTimes(stop).scheduled || stopTimes(stop).estimated,
      }))
    : scheduledStops;

  return (
    <Screen
      header={false}
      refreshControl={
        <RefreshControl
          refreshing={details.isRefetching}
          onRefresh={() => {
            void details.refetch();
          }}
        />
      }
    >
      <Card>
        <View style={styles.row}>
          {lineCode && <LineBadge code={lineCode} />}
          <Text style={styles.routeTitle}>{title}</Text>
        </View>
        <Text style={styles.subtitle}>
          {serviceDate(date)} - Trip {tripNumber}
        </Text>
        {trip?.timestamp && (
          <Text style={styles.updated}>Updated {serviceTimestamp(trip.timestamp)}</Text>
        )}
      </Card>
      {details.isError && (
        <RequestState
          message={`${details.error.message}${scheduledStops.length ? ' Showing the line timetable below.' : ''}`}
          onRetry={() => {
            void details.refetch();
          }}
        />
      )}
      {details.fetchStatus === 'paused' && (
        <Text style={styles.subtitle}>
          You are offline. Previously loaded times may be outdated.
        </Text>
      )}
      <Card>
        <SectionHeading title="Stops & Times" />
        {timeline.length ? (
          <StopTimeline
            stops={timeline}
            stopName={stopName}
            renderTime={(stop, index) =>
              reportedStops[index] ? (
                <StopTime {...stopTimes(reportedStops[index])} />
              ) : (
                <StopTime scheduled={stop.time} />
              )
            }
            renderNotes={(_stop, index) => {
              const stop = reportedStops[index];
              if (!stop) return null;
              const platform = stop.track_actual || stop.track_scheduled;
              return platform && !['-', '--'].includes(platform.trim()) ? (
                <Text style={styles.updated}>Platform {platform}</Text>
              ) : null;
            }}
          />
        ) : (
          <RequestState
            loading={details.isPending && details.fetchStatus === 'fetching'}
            message={
              details.isPending
                ? 'Loading trip stops...'
                : 'No stop details were provided for this trip.'
            }
          />
        )}
      </Card>
    </Screen>
  );
}
