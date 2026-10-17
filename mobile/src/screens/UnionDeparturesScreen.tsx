import { RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import { transitApi } from '../api/transit';
import { checkedTime, torontoDateTime, serviceLineCode } from '../utils/transit';
import { Screen } from '../components/layout/Screen';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { DepartureRow } from '../components/transit/DepartureRow';
import { RequestState } from '../components/RequestState';
import { styles } from './screens.styles';

export function UnionDeparturesScreen({
  navigation,
}: NativeStackScreenProps<RootStackParams, 'UnionDepartures'>) {
  const focused = useIsFocused();
  const departures = useQuery({
    queryKey: ['unionDepartures'],
    queryFn: ({ signal }) => transitApi.unionDepartures(signal),
    staleTime: 15000,
    refetchInterval: 30000,
    subscribed: focused,
  });
  return (
    <Screen
      header={false}
      refreshControl={
        <RefreshControl
          refreshing={departures.isRefetching}
          onRefresh={() => {
            void departures.refetch();
          }}
        />
      }
    >
      <Card>
        <SectionHeading title="Union Station" />
        <Text style={styles.subtitle}>
          Live departures and boarding platforms. Tap a departure for its stops and times.
        </Text>
        {!!departures.dataUpdatedAt && (
          <Text style={styles.updated}>Last checked {checkedTime(departures.dataUpdatedAt)}</Text>
        )}
      </Card>
      {departures.isError && (
        <RequestState
          message={`${departures.error.message}${departures.data ? ' Showing previously loaded departures.' : ''}`}
          onRetry={() => {
            void departures.refetch();
          }}
        />
      )}
      {departures.fetchStatus === 'paused' && (
        <Text style={styles.subtitle}>
          You are offline. Previously loaded departures may be outdated.
        </Text>
      )}
      <Card padded={false}>
        <View style={styles.resultsHeader}>
          <SectionHeading title="Upcoming Departures" />
        </View>
        {departures.data?.departures?.map((departure, index) => (
          <DepartureRow
            key={`${departure.trip_number}-${index}`}
            time={departure.departure_datetime}
            estimated={departure.computed_departure_time}
            destination={departure.destination || departure.service}
            lineCode={serviceLineCode(departure.service)}
            platform={departure.platform}
            status={departure.info || departure.boarding_status}
            onPress={() =>
              navigation.navigate('ScheduleTripDetails', {
                tripNumber: departure.trip_number,
                title: departure.destination || departure.service,
                lineCode: serviceLineCode(departure.service),
                date:
                  departure.service_date ??
                  departure.departure_datetime.match(/^\d{4}-\d{2}-\d{2}/)?.[0].replace(/-/g, '') ??
                  torontoDateTime().date,
                displayDate: departure.departure_datetime.slice(0, 10).replace(/-/g, ''),
              })
            }
          />
        ))}
        {!departures.data?.departures?.length && (
          <RequestState
            loading={departures.isPending && departures.fetchStatus === 'fetching'}
            message={
              departures.fetchStatus === 'paused'
                ? 'Reconnect to load departures.'
                : departures.isPending
                  ? 'Loading departures...'
                  : departures.isError
                    ? 'Departures unavailable.'
                    : 'No departures were reported.'
            }
          />
        )}
      </Card>
    </Screen>
  );
}
