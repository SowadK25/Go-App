import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import { transitApi } from '../api/transit';
import { Screen } from '../components/layout/Screen';
import { Card } from '../components/ui/Card';
import { LineBadge } from '../components/ui/LineBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RequestState } from '../components/RequestState';
import { serviceTime, journeyDuration, vehicleName } from '../utils/transit';
import { useStops } from '../hooks/transitQueries';
import { styles } from './screens.styles';
export function TripResultsScreen({
  route,
}: NativeStackScreenProps<RootStackParams, 'TripResults'>) {
  const { fromCode, fromName, toCode, toName, date, time } = route.params;
  const stops = useStops();
  const stopName = (code: string) => stops.data?.find((stop) => stop.id === code)?.name ?? code;
  const journeys = useQuery({
    queryKey: ['journeys', fromCode, toCode, date, time],
    queryFn: ({ signal }) => transitApi.journeys(fromCode, toCode, date, time, 5, signal),
  });
  const fares = useQuery({
    queryKey: ['fares', fromCode, toCode, date],
    queryFn: ({ signal }) => transitApi.fares(fromCode, toCode, date, signal),
    staleTime: 86400000,
  });
  return (
    <Screen header={false}>
      <Card>
        <Text style={styles.routeTitle}>
          {fromName} → {toName}
        </Text>
        <Text style={styles.subtitle}>
          {date.slice(0, 4)}-{date.slice(4, 6)}-{date.slice(6)} · Depart after{' '}
          {serviceTime(`${time.slice(0, 2)}:${time.slice(2)}`)} Toronto time
        </Text>
      </Card>
      {journeys.isPending && (
        <RequestState
          loading={journeys.fetchStatus === 'fetching'}
          message={
            journeys.fetchStatus === 'paused'
              ? 'Reconnect to search trips.'
              : 'Finding your journey...'
          }
        />
      )}
      {journeys.isError && (
        <RequestState
          message={journeys.error.message}
          onRetry={() => {
            void journeys.refetch();
          }}
        />
      )}
      {journeys.data && !journeys.data.journeys.length && (
        <RequestState message="No journeys found. Try another departure time or station." />
      )}
      {journeys.data?.journeys.map((journey, index) => (
        <Card key={`${journey.trip_hash ?? index}-${journey.start_time}`}>
          <View style={styles.row}>
            <Text style={styles.journeyTime}>
              {serviceTime(journey.start_time)} → {serviceTime(journey.end_time)}
            </Text>
          </View>
          <View style={styles.wrap}>
            {journey.duration && <StatusBadge label={journeyDuration(journey.duration)} />}
            <StatusBadge
              label={
                journey.transfer_count
                  ? `${journey.transfer_count} transfer${journey.transfer_count > 1 ? 's' : ''}`
                  : 'Direct trip'
              }
            />
          </View>
          {journey.trips?.map((leg, legIndex) => (
            <View key={`${leg.number}-${legIndex}`} style={styles.journeyLeg}>
              <View style={styles.row}>
                <LineBadge code={leg.line} />
                <Text style={styles.label}>{leg.display}</Text>
              </View>
              <Text style={styles.subtitle}>
                {vehicleName(leg.vehicle_type)} · {stopName(leg.depart_from_code)} →{' '}
                {stopName(leg.destination_stop_code)}
              </Text>
            </View>
          ))}
        </Card>
      ))}
      <Card>
        <Text style={styles.label}>Fare options</Text>
        {fares.isPending && (
          <RequestState loading={fares.fetchStatus === 'fetching'} message="Checking fares..." />
        )}
        {fares.isError && (
          <RequestState
            message={fares.error.message}
            onRetry={() => {
              void fares.refetch();
            }}
          />
        )}
        {fares.data?.fares?.map((fare, index) => (
          <View style={styles.row} key={`${fare.rider_type}-${fare.payment_type}-${index}`}>
            <View style={styles.column}>
              <Text style={styles.label}>
                {fare.rider_type} · {fare.payment_type}
              </Text>
              <Text style={styles.subtitle}>{fare.fare_type}</Text>
            </View>
            <Text style={styles.label}>
              ${fare.amount.toFixed(2)} {fare.currency ?? 'CAD'}
            </Text>
          </View>
        ))}
        {fares.data && !fares.data.fares?.length && (
          <Text style={styles.subtitle}>No fare information is available for this route.</Text>
        )}
      </Card>
    </Screen>
  );
}
