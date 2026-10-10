import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParams } from '../navigation/types';
import { useLines, useStops } from '../hooks/transitQueries';
import { transitApi } from '../api/transit';
import { Screen } from '../components/layout/Screen';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { ChoiceChip } from '../components/transit/ChoiceChip';
import { DepartureRow } from '../components/transit/DepartureRow';
import { RequestState } from '../components/RequestState';
import { styles } from './screens.styles';
import { styles as transitStyles } from '../components/transit/transit.styles';
export function SchedulesScreen({
  route,
  navigation,
}: BottomTabScreenProps<MainTabParams, 'Schedules'>) {
  const lines = useLines();
  const stops = useStops();
  const focused = useIsFocused();
  const [lineCode, setLineCode] = useState<string | null>(null);
  const [direction, setDirection] = useState<string | null>(null);
  useEffect(() => {
    if (route.params?.lineCode) {
      setLineCode(route.params.lineCode);
      setDirection(null);
    }
  }, [route.params?.lineCode]);
  const selected =
    lines.data?.lines?.find((line) => line.code === lineCode) ??
    (!lineCode
      ? (lines.data?.lines?.find((line) => line.code === 'LW') ?? lines.data?.lines?.[0])
      : undefined);
  const activeDirection = selected?.directions?.includes(direction ?? '')
    ? direction
    : selected?.directions?.[0];
  const schedule = useQuery({
    queryKey: ['lineSchedule', selected?.code, activeDirection],
    enabled: !!selected && !!activeDirection,
    queryFn: ({ signal }) =>
      transitApi.lineSchedule(selected!.code, activeDirection!, undefined, signal),
    staleTime: 300000,
  });
  const union = useQuery({
    queryKey: ['unionDepartures'],
    queryFn: ({ signal }) => transitApi.unionDepartures(signal),
    staleTime: 15000,
    refetchInterval: 30000,
    subscribed: focused,
  });
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={union.isRefetching || schedule.isRefetching}
          onRefresh={() => {
            void union.refetch();
            void lines.refetch();
            if (selected && activeDirection) void schedule.refetch();
          }}
        />
      }
    >
      <Text style={styles.title}>Schedules</Text>
      <Card>
        <SectionHeading title="Select Line" />
        {lines.isError && (
          <RequestState
            message={lines.error.message}
            onRetry={() => {
              void lines.refetch();
            }}
          />
        )}
        {lines.isPending && (
          <RequestState loading={lines.fetchStatus === 'fetching'} message="Loading lines..." />
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={transitStyles.chips}
        >
          {lines.data?.lines?.map((line) => (
            <ChoiceChip
              key={line.code}
              label={line.name}
              lineCode={line.code}
              selected={selected?.code === line.code}
              onPress={() => {
                setLineCode(line.code);
                navigation.setParams({ lineCode: line.code });
                setDirection(null);
              }}
            />
          ))}
        </ScrollView>
        <View style={styles.wrap}>
          {selected?.directions?.map((value) => (
            <ChoiceChip
              key={value}
              label={
                selected.variants?.find((variant) => variant.direction === value)?.display || value
              }
              selected={activeDirection === value}
              onPress={() => setDirection(value)}
            />
          ))}
        </View>
        {lineCode && !selected && (
          <Text style={styles.subtitle}>No schedule is listed for this line today.</Text>
        )}
      </Card>
      {selected && (
        <Card padded={false}>
          <View style={styles.resultsHeader}>
            <SectionHeading title={selected.name} />
            <Text style={styles.subtitle}>
              Today · {activeDirection ?? 'No direction available'}
            </Text>
          </View>
          {schedule.isError && (
            <RequestState
              message={schedule.error.message}
              onRetry={() => {
                void schedule.refetch();
              }}
            />
          )}
          {schedule.isPending && !!activeDirection && (
            <RequestState
              loading={schedule.fetchStatus === 'fetching'}
              message="Loading schedule..."
            />
          )}
          {schedule.data?.trips?.map((trip) => (
            <DepartureRow
              key={trip.number}
              time={trip.stops?.[0]?.time ?? ''}
              destination={trip.display || `Trip ${trip.number}`}
              origin={
                stops.data?.find((stop) => stop.id === trip.stops?.[0]?.code)?.name ??
                trip.stops?.[0]?.code
              }
              lineCode={selected.code}
              status="Scheduled"
            />
          ))}
          {schedule.data && !schedule.data.trips?.length && (
            <RequestState message="No scheduled trips were returned for this direction." />
          )}
        </Card>
      )}
      <Card padded={false}>
        <View style={styles.resultsHeader}>
          <SectionHeading title="Union Station Departures" />
          <Text style={styles.subtitle}>Live departure board</Text>
        </View>
        {union.isError && (
          <RequestState
            message={union.error.message}
            onRetry={() => {
              void union.refetch();
            }}
          />
        )}
        {union.data?.departures?.map((departure, index) => (
          <DepartureRow
            key={`${departure.trip_number}-${index}`}
            time={departure.departure_time}
            destination={departure.destination || departure.service}
            platform={departure.platform}
            status={departure.info || departure.boarding_status}
          />
        ))}
        {!union.data?.departures?.length && (
          <RequestState
            loading={union.isPending && union.fetchStatus === 'fetching'}
            message={
              union.isPending
                ? 'Loading departures...'
                : union.isError
                  ? 'Departures unavailable.'
                  : 'No departures were reported.'
            }
          />
        )}
      </Card>
    </Screen>
  );
}
