import { RefreshControl, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import { useStops } from '../hooks/transitQueries';
import { useJourneyStatuses } from '../hooks/useJourneyStatuses';
import { useJourneyPredictions } from '../hooks/useJourneyPredictions';
import { journeyEndpoints, journeyStopTime } from '../utils/journeyPredictions';
import { JourneyTimes } from '../components/transit/JourneyTimes';
import { StopTime } from '../components/transit/StopTime';
import { journeyDuration, vehicleName, easternTimeLabel } from '../utils/transit';
import { legStops, transferCount } from '../utils/journeys';
import { Screen } from '../components/layout/Screen';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { LineBadge } from '../components/ui/LineBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { StopTimeline } from '../components/transit/StopTimeline';
import { styles } from './screens.styles';
import { ActionButton } from '../components/ui/ActionButton';
import { usePreferences } from '../storage/PreferencesProvider';
import { trackingExpired, trackedTripKey } from '../storage/preferences';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export function JourneyDetailsScreen({
  route,
}: NativeStackScreenProps<RootStackParams, 'JourneyDetails'>) {
  const { journey, fromName, toName, date } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { trackedTrip, trackTrip, ready, storageError } = usePreferences();
  const tracking = !!trackedTrip && trackedTripKey(trackedTrip) === trackedTripKey(route.params);
  const stops = useStops();
  const stopName = (code: string) => stops.data?.find((stop) => stop.id === code)?.name ?? code;
  const transfers = transferCount(journey);
  const statuses = useJourneyStatuses([journey]);
  const overallStatus = statuses.journeyStatus(journey);
  const predictions = useJourneyPredictions([journey], true);
  const times = journeyEndpoints(
    journey,
    journey.trips?.map((_leg, index) => predictions.trip(journey, index)) ?? [],
  );
  return (
    <Screen
      header={false}
      refreshControl={
        <RefreshControl
          refreshing={statuses.refreshing || predictions.refreshing}
          onRefresh={() => {
            void statuses.refresh();
            void predictions.refresh();
          }}
        />
      }
    >
      <Card>
        <Text style={styles.routeTitle}>
          {fromName} → {toName}
        </Text>
        <JourneyTimes {...times} />
        <Text style={styles.subtitle}>
          {date.slice(0, 4)}-{date.slice(4, 6)}-{date.slice(6)} · {easternTimeLabel(date)}
        </Text>
        <View style={styles.wrap}>
          <StatusBadge label={overallStatus.label} tone={overallStatus.tone} />
          {journey.duration && (
            <StatusBadge
              label={`${journeyDuration(journey.duration)}${times.departure.estimated || times.arrival.estimated ? ' scheduled' : ''}`}
            />
          )}
          <StatusBadge
            label={transfers ? `${transfers} transfer${transfers > 1 ? 's' : ''}` : 'Direct trip'}
          />
        </View>
        <Text style={styles.subtitle}>
          Updated stop predictions appear beside the scheduled time when available.
        </Text>
        {!!journey.trips?.length && !trackingExpired(route.params) && (
          <ActionButton
            title={tracking ? 'Stop tracking trip' : 'Track trip'}
            icon="navigation"
            secondary
            disabled={!ready}
            onPress={() => {
              trackTrip(tracking ? null : route.params);
              if (!tracking) navigation.popTo('Main', { screen: 'Home' });
            }}
          />
        )}
        {!tracking && !!trackedTrip && (
          <Text style={styles.subtitle}>
            Tracking this trip will replace your current tracked trip.
          </Text>
        )}
        {!!storageError && <Text style={styles.subtitle}>{storageError}</Text>}
      </Card>
      {!journey.trips?.length && (
        <Card>
          <Text style={styles.subtitle}>Stop details were not provided for this journey.</Text>
        </Card>
      )}
      {journey.trips?.map((leg, index) => {
        const timeline = legStops(leg);
        const status = statuses.legStatus(journey, index);
        const report = predictions.trip(journey, index);
        return (
          <View key={`${leg.number}-${index}`} style={styles.journeySection}>
            {index > 0 && (
              <Card>
                <SectionHeading title={`Transfer at ${stopName(leg.depart_from_code)}`} />
                <Text style={styles.subtitle}>
                  Change to {vehicleName(leg.vehicle_type).toLowerCase()} service {leg.line}.{' '}
                  {leg.display}
                </Text>
              </Card>
            )}
            <Card>
              <View style={styles.row}>
                <LineBadge code={leg.line} />
                <Text style={styles.label}>{leg.display}</Text>
              </View>
              <Text style={styles.subtitle}>
                {vehicleName(leg.vehicle_type)} · Trip {leg.number}
              </Text>
              <StatusBadge label={status.label} tone={status.tone} />
              <Text style={styles.label}>
                {stopName(leg.depart_from_code)} → {stopName(leg.destination_stop_code)}
              </Text>
              {timeline.length ? (
                <StopTimeline
                  stops={timeline}
                  stopName={stopName}
                  renderTime={(stop, stopIndex) => (
                    <StopTime
                      {...journeyStopTime(
                        stop,
                        report,
                        stopIndex === 0
                          ? 'departure'
                          : stopIndex === timeline.length - 1
                            ? 'arrival'
                            : 'auto',
                      )}
                    />
                  )}
                  renderNotes={(stop) => {
                    const details = report?.stops?.find((item) => item.code === stop.code);
                    const platform = details?.track_actual || details?.track_scheduled;
                    return platform && !['-', '--'].includes(platform.trim()) ? (
                      <Text style={styles.updated}>Platform {platform}</Text>
                    ) : null;
                  }}
                />
              ) : (
                <Text style={styles.subtitle}>
                  Stop times were not provided for this part of the journey.
                </Text>
              )}
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}
