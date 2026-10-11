import { useMemo, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import { transitApi } from '../api/transit';
import { Screen } from '../components/layout/Screen';
import { Card } from '../components/ui/Card';
import { SegmentedTabs } from '../components/ui/SegmentedTabs';
import { FareOptionsCard } from '../components/transit/FareOptionsCard';
import { RequestState } from '../components/RequestState';
import { serviceTime, easternTimeLabel } from '../utils/transit';
import { filterJourneys, transferCount, type JourneyFilter } from '../utils/journeys';
import { ChoiceChip } from '../components/transit/ChoiceChip';
import { JourneyCard } from '../components/transit/JourneyCard';
import { useStops } from '../hooks/transitQueries';
import { useJourneyStatuses } from '../hooks/useJourneyStatuses';
import { useJourneyPredictions } from '../hooks/useJourneyPredictions';
import { journeyEndpoints } from '../utils/journeyPredictions';
import { styles } from './screens.styles';
export function TripResultsScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParams, 'TripResults'>) {
  const { fromCode, fromName, toCode, toName, date, time } = route.params;
  const [tab, setTab] = useState<'trips' | 'fares'>('trips');
  const [filter, setFilter] = useState<JourneyFilter>('all');
  const stops = useStops();
  const stopName = (code: string) => stops.data?.find((stop) => stop.id === code)?.name ?? code;
  const journeys = useQuery({
    queryKey: ['journeys', fromCode, toCode, date, time, 10],
    queryFn: ({ signal }) => transitApi.journeys(fromCode, toCode, date, time, 10, signal),
  });
  const results = useMemo(
    () => filterJourneys(journeys.data?.journeys ?? [], filter),
    [journeys.data, filter],
  );
  const statuses = useJourneyStatuses(journeys.data?.journeys ?? [], tab === 'trips');
  const predictions = useJourneyPredictions(journeys.data?.journeys ?? [], false, tab === 'trips');
  const directCount =
    journeys.data?.journeys.filter((journey) => transferCount(journey) === 0).length ?? 0;
  const totalCount = journeys.data?.journeys.length ?? 0;
  return (
    <Screen
      header={false}
      refreshControl={
        tab === 'trips' ? (
          <RefreshControl
            refreshing={journeys.isRefetching || statuses.refreshing}
            onRefresh={() => {
              void journeys.refetch();
              void statuses.refresh();
            }}
          />
        ) : undefined
      }
    >
      <Card>
        <Text style={styles.routeTitle}>
          {fromName} → {toName}
        </Text>
        <Text style={styles.subtitle}>
          {date.slice(0, 4)}-{date.slice(4, 6)}-{date.slice(6)} · Depart after{' '}
          {serviceTime(`${time.slice(0, 2)}:${time.slice(2)}`)} {easternTimeLabel(date)}
        </Text>
      </Card>
      <SegmentedTabs
        options={[
          { value: 'trips', label: 'Trips' },
          { value: 'fares', label: 'Fares' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'trips' ? (
        <>
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
          {!!totalCount && (
            <Card>
              <Text style={styles.label}>Trip options</Text>
              <View style={styles.wrap}>
                <ChoiceChip
                  label={`All (${totalCount})`}
                  selected={filter === 'all'}
                  onPress={() => setFilter('all')}
                />
                <ChoiceChip
                  label={`Direct (${directCount})`}
                  selected={filter === 'direct'}
                  onPress={() => setFilter('direct')}
                />
                <ChoiceChip
                  label={`With transfers (${totalCount - directCount})`}
                  selected={filter === 'transfers'}
                  onPress={() => setFilter('transfers')}
                />
              </View>
              <Text style={styles.subtitle}>Tap a trip for stops and times.</Text>
            </Card>
          )}
          {!!totalCount && !results.length && (
            <RequestState
              message={`No ${filter === 'direct' ? 'direct trips' : 'trips with transfers'} in these results. Try another departure time or view all trips.`}
            />
          )}
          {results.map((journey, index) => (
            <JourneyCard
              key={`${journey.trip_hash ?? index}-${journey.start_time}`}
              journey={journey}
              {...journeyEndpoints(
                journey,
                journey.trips?.map((_leg, index) => predictions.trip(journey, index)) ?? [],
              )}
              stopName={stopName}
              status={statuses.journeyStatus(journey)}
              legStatuses={
                journey.trips?.map((_leg, index) => statuses.legStatus(journey, index)) ?? []
              }
              onPress={() =>
                navigation.navigate('JourneyDetails', { journey, fromName, toName, date })
              }
            />
          ))}
        </>
      ) : (
        <FareOptionsCard fromCode={fromCode} toCode={toCode} date={date} />
      )}
    </Screen>
  );
}
