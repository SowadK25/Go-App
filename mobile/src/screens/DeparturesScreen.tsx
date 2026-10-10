import { useMemo } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import { transitApi } from '../api/transit';
import { useAlerts, useStops } from '../hooks/transitQueries';
import { usePreferences } from '../storage/PreferencesProvider';
import { Screen } from '../components/layout/Screen';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { ActionButton } from '../components/ui/ActionButton';
import { DepartureRow } from '../components/transit/DepartureRow';
import { RequestState } from '../components/RequestState';
import { plainText, checkedTime } from '../utils/transit';
import { styles } from './screens.styles';
export function DeparturesScreen({ route }: NativeStackScreenProps<RootStackParams, 'Departures'>) {
  const { stopCode, stopName } = route.params;
  const focused = useIsFocused();
  const { favorites, toggleFavorite, ready } = usePreferences();
  const stops = useStops();
  const favorite = favorites.some((stop) => stop.id === stopCode);
  const departures = useQuery({
    queryKey: ['departures', stopCode],
    queryFn: ({ signal }) => transitApi.departures(stopCode, signal),
    staleTime: 15000,
    refetchInterval: 30000,
    subscribed: focused,
  });
  const details = useQuery({
    queryKey: ['stopDetails', stopCode],
    queryFn: ({ signal }) => transitApi.stopDetails(stopCode, signal),
    staleTime: 86400000,
  });
  const sortedDepartures = useMemo(
    () =>
      [...(departures.data?.lines ?? [])].sort((a, b) =>
        (a.computed_departure_time || a.scheduled_departure_time).localeCompare(
          b.computed_departure_time || b.scheduled_departure_time,
        ),
      ),
    [departures.data],
  );
  const alerts = useAlerts(stopCode);
  const notices = [
    ...(alerts.data?.service_alerts ?? []),
    ...(alerts.data?.information_alerts ?? []),
  ];
  return (
    <Screen
      header={false}
      refreshControl={
        <RefreshControl
          refreshing={departures.isRefetching}
          onRefresh={() => {
            void departures.refetch();
            void alerts.refetch();
          }}
        />
      }
    >
      <Card>
        <Text style={styles.title}>{stopName}</Text>
        {details.data?.address && <Text style={styles.subtitle}>{details.data.address}</Text>}
        <ActionButton
          title={favorite ? 'Remove from Favorites' : 'Save to Favorites'}
          secondary
          icon="star"
          disabled={!ready}
          onPress={() =>
            toggleFavorite({
              id: stopCode,
              name: stopName,
              type: stops.data?.find((stop) => stop.id === stopCode)?.type ?? 'Station',
            })
          }
        />
        {!!departures.dataUpdatedAt && (
          <Text style={styles.updated}>Last checked {checkedTime(departures.dataUpdatedAt)}</Text>
        )}
      </Card>
      {departures.fetchStatus === 'paused' && (
        <Text style={styles.subtitle}>
          You are offline. Previously loaded departures may be outdated.
        </Text>
      )}
      {departures.isError && (
        <RequestState
          message={`${departures.error.message}${departures.data ? ' Showing previously loaded departures.' : ''}`}
          onRetry={() => {
            void departures.refetch();
          }}
        />
      )}
      <Card padded={false}>
        <View style={styles.resultsHeader}>
          <SectionHeading title="Upcoming Departures" />
        </View>
        {sortedDepartures.map((line, index) => (
          <DepartureRow
            key={`${line.trip_number}-${index}`}
            time={line.computed_departure_time || line.scheduled_departure_time}
            destination={line.direction_name || line.line_name}
            lineCode={line.line_code}
            platform={line.platform_number}
            status={line.computed_departure_time ? 'Estimated' : 'Scheduled'}
            scheduled={line.scheduled_departure_time}
          />
        ))}
        {!departures.data?.lines.length && (
          <RequestState
            loading={departures.isPending && departures.fetchStatus === 'fetching'}
            message={
              departures.isPending
                ? 'Loading departures...'
                : departures.isError
                  ? 'Departures unavailable.'
                  : 'No upcoming departures were reported.'
            }
          />
        )}
      </Card>
      <Card>
        <SectionHeading title="Station Updates" />
        {alerts.isPending && (
          <RequestState loading={alerts.fetchStatus === 'fetching'} message="Checking updates..." />
        )}
        {alerts.isError && (
          <RequestState
            message={alerts.error.message}
            onRetry={() => {
              void alerts.refetch();
            }}
          />
        )}
        {alerts.data && !notices.length && (
          <Text style={styles.subtitle}>No station updates were reported.</Text>
        )}
        {notices.map((alert) => (
          <View style={styles.column} key={`${alert.alert_type}-${alert.code}`}>
            <Text style={styles.label}>{plainText(alert.title)}</Text>
            <Text style={styles.alertBody}>{plainText(alert.body)}</Text>
          </View>
        ))}
      </Card>
      {details.isError && (
        <RequestState
          message={`Station details: ${details.error.message}`}
          onRetry={() => {
            void details.refetch();
          }}
        />
      )}
    </Screen>
  );
}
