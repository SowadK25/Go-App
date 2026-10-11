import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParams, RootStackParams } from '../navigation/types';
import { torontoDateTime } from '../utils/transit';
import { useLines, useStops } from '../hooks/transitQueries';
import { transitApi } from '../api/transit';
import { Screen } from '../components/layout/Screen';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { ChoiceChip } from '../components/transit/ChoiceChip';
import { DepartureRow } from '../components/transit/DepartureRow';
import { LinePicker } from '../components/transit/LinePicker';
import { LineBadge } from '../components/ui/LineBadge';
import { Icon } from '../components/ui/Icon';
import { RequestState } from '../components/RequestState';
import { styles } from './screens.styles';
import { styles as linePickerStyles } from '../components/transit/LinePicker.styles';
export function SchedulesScreen({
  route,
  navigation,
}: BottomTabScreenProps<MainTabParams, 'Schedules'>) {
  const lines = useLines();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const stops = useStops();
  const [lineCode, setLineCode] = useState<string | null>(null);
  const [direction, setDirection] = useState<string | null>(null);
  const [showLinePicker, setShowLinePicker] = useState(false);
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
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={lines.isRefetching || schedule.isRefetching}
          onRefresh={() => {
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose schedule line"
          disabled={!lines.data?.lines?.length}
          style={linePickerStyles.trigger}
          onPress={() => setShowLinePicker(true)}
        >
          {selected && <LineBadge code={selected.code} />}
          <View style={linePickerStyles.details}>
            <Text style={linePickerStyles.name}>{selected?.name ?? 'Choose a line'}</Text>
            <Text style={linePickerStyles.mode}>
              {selected?.vehicle_types?.join(' & ') || 'Browse train and bus lines'}
            </Text>
          </View>
          <Icon name="chevron-down" size={18} />
        </Pressable>
        {!!selected?.directions?.length && <Text style={styles.label}>Direction of travel</Text>}
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
      <LinePicker
        lines={lines.data?.lines ?? []}
        selectedCode={selected?.code}
        visible={showLinePicker}
        onClose={() => setShowLinePicker(false)}
        onSelect={(line) => {
          setLineCode(line.code);
          navigation.setParams({ lineCode: line.code });
          setDirection(null);
        }}
      />
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
              onPress={() =>
                rootNavigation.navigate('ScheduleTripDetails', {
                  tripNumber: trip.number,
                  title: trip.display || selected.name,
                  lineCode: selected.code,
                  date: (schedule.data?.date ?? torontoDateTime().date).replace(/-/g, ''),
                  scheduledStops: trip.stops?.map((stop) => ({
                    code: stop.code,
                    order: stop.order,
                    time: stop.time,
                    is_major: stop.is_major,
                  })),
                })
              }
            />
          ))}
          {schedule.data && !schedule.data.trips?.length && (
            <RequestState message="No scheduled trips were returned for this direction." />
          )}
        </Card>
      )}
    </Screen>
  );
}
