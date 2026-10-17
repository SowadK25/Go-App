import { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
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
import { StationDepartureRow } from '../components/transit/StationDepartureRow';
import { TripDateField } from '../components/transit/TripDateField';
import { initialSearchDate, searchDateTime } from '../utils/tripSearch';
import { stationDeparturePrediction } from '../utils/stationDepartures';
import { RequestState } from '../components/RequestState';
import { plainText, checkedTime, torontoDateTime } from '../utils/transit';
import { styles } from './screens.styles';
import { styles as departureStyles } from './DeparturesScreen.styles';
export function DeparturesScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParams, 'Departures'>) {
  const { stopCode, stopName } = route.params;
  const focused = useIsFocused();
  const [day, setDay] = useState(initialSearchDate);
  const date = searchDateTime(day).date;
  const today = date === torontoDateTime().date;
  const { favorites, toggleFavorite, ready } = usePreferences();
  const stops = useStops();
  const favorite = favorites.some((stop) => stop.id === stopCode);
  const departures = useQuery({
    queryKey: ['stationDepartures', stopCode, date],
    queryFn: ({ signal }) => transitApi.stationDepartures(stopCode, date, signal),
    staleTime: 86400000,
    subscribed: focused,
    retry: false,
  });
  const hasDepartures = !!departures.data?.departures?.length;
  const live = useQuery({
    queryKey: ['departures', stopCode],
    queryFn: ({ signal }) => transitApi.departures(stopCode, signal),
    enabled: today && focused,
    subscribed: today && focused,
    staleTime: 60000,
    refetchInterval: 60000,
    retry: false,
  });
  const details = useQuery({
    queryKey: ['stopDetails', stopCode],
    queryFn: ({ signal }) => transitApi.stopDetails(stopCode, signal),
    staleTime: 86400000,
  });
  const alerts = useAlerts(stopCode);
  const notices = [
    ...(alerts.data?.service_alerts ?? []),
    ...(alerts.data?.information_alerts ?? []),
  ];
  const upAlertsUnavailable =
    ['UN', 'BL', 'MD', 'WE', 'PA'].includes(stopCode) &&
    alerts.data?.unavailable_lines?.includes('UP');
  return (
    <Screen header={false} scroll={false}>
      <FlatList
        contentContainerStyle={styles.content}
        data={departures.data?.departures ?? []}
        keyExtractor={(item) =>
          `${item.trip_number}-${item.service_date}-${item.scheduled_departure_time}`
        }
        ItemSeparatorComponent={() => <View style={departureStyles.separator} />}
        renderItem={({ item }) => (
          <StationDepartureRow
            departure={item}
            prediction={
              today &&
              !live.isError &&
              live.fetchStatus !== 'paused' &&
              Date.now() - live.dataUpdatedAt <= 120000
                ? stationDeparturePrediction(item, live.data?.lines ?? [])
                : undefined
            }
            onPress={() =>
              navigation.navigate('ScheduleTripDetails', {
                tripNumber: item.trip_number,
                title: item.destination,
                lineCode: item.line_code,
                date: item.service_date,
                displayDate: date,
                scheduledStops: item.stops,
              })
            }
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={departures.isRefetching || live.isRefetching}
            onRefresh={() => {
              void departures.refetch();
              if (today) void live.refetch();
              void alerts.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <View style={[departureStyles.header, !hasDepartures && departureStyles.emptyHeader]}>
            <Card>
              <Text style={styles.title}>{stopName}</Text>
              <TripDateField value={day} onChange={setDay} />
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
                <Text style={styles.updated}>
                  Last checked {checkedTime(departures.dataUpdatedAt)}
                </Text>
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
            {today && live.isError && hasDepartures && (
              <Text style={styles.subtitle}>
                Live updates are unavailable. Showing scheduled departures.
              </Text>
            )}
            <View>
              <SectionHeading title="Departures" />
              {!!departures.data?.departures?.length && (
                <Text style={styles.subtitle}>
                  All scheduled departures for this day, including earlier trips. Tap a departure
                  for stops and times.
                </Text>
              )}
              {!hasDepartures && (
                <RequestState
                  compact
                  loading={departures.isPending && departures.fetchStatus === 'fetching'}
                  message={
                    departures.isPending
                      ? departures.fetchStatus === 'paused'
                        ? 'Reconnect to load the timetable.'
                        : 'Loading departures for the day...'
                      : departures.isError
                        ? 'Timetable unavailable.'
                        : 'No departures scheduled for this date.'
                  }
                />
              )}
            </View>
          </View>
        }
        ListFooterComponent={
          <View style={[departureStyles.footer, !hasDepartures && departureStyles.emptyFooter]}>
            <Card>
              <SectionHeading title="Station Updates" />
              {alerts.isPending && (
                <RequestState
                  loading={alerts.fetchStatus === 'fetching'}
                  message="Checking updates..."
                />
              )}
              {alerts.isError && (
                <RequestState
                  message={alerts.error.message}
                  onRetry={() => {
                    void alerts.refetch();
                  }}
                />
              )}
              {upAlertsUnavailable && (
                <Text style={styles.subtitle}>
                  UP Express station updates are temporarily unavailable. Try refreshing.
                </Text>
              )}
              {alerts.data && !notices.length && !upAlertsUnavailable && (
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
          </View>
        }
      />
    </Screen>
  );
}
