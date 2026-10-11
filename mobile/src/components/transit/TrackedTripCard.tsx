import { useEffect } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../../navigation/types';
import { usePreferences } from '../../storage/PreferencesProvider';
import { trackingExpired } from '../../storage/preferences';
import { useJourneyStatuses } from '../../hooks/useJourneyStatuses';
import { useJourneyPredictions } from '../../hooks/useJourneyPredictions';
import { journeyEndpoints } from '../../utils/journeyPredictions';
import { serviceDate, easternTimeLabel } from '../../utils/transit';
import { Card } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { StatusBadge } from '../ui/StatusBadge';
import { LineBadge } from '../ui/LineBadge';
import { JourneyTimes } from './JourneyTimes';
import { styles } from './TrackedTripCard.styles';

export function TrackedTripCard() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { trackedTrip, trackTrip } = usePreferences();
  const focused = useIsFocused();
  const journeys = trackedTrip ? [trackedTrip.journey] : [];
  const statuses = useJourneyStatuses(journeys, !!trackedTrip);
  const predictions = useJourneyPredictions(journeys, true, !!trackedTrip);
  useEffect(() => {
    if (!trackedTrip || !focused) return;
    const expire = () => {
      if (trackingExpired(trackedTrip)) trackTrip(null);
    };
    expire();
    const timer = setInterval(expire, 60000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') expire();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [trackedTrip, focused, trackTrip]);
  if (!trackedTrip || trackingExpired(trackedTrip)) return null;
  const { journey, fromName, toName, date } = trackedTrip;
  const reports = journey.trips?.map((_leg, index) => predictions.trip(journey, index)) ?? [];
  const times = journeyEndpoints(journey, reports);
  return (
    <Card padded={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open tracked trip from ${fromName} to ${toName}`}
        onPress={() => navigation.navigate('JourneyDetails', trackedTrip)}
        style={({ pressed }) => [styles.content, pressed && styles.pressed]}
      >
        <View style={styles.heading}>
          <SectionHeading title="Tracked Trip" />
          <Icon name="chevron-right" size={18} />
        </View>
        <Text style={styles.route}>
          {fromName} → {toName}
        </Text>
        <Text style={styles.subtitle}>
          {serviceDate(date)} - {easternTimeLabel(date)}
        </Text>
        <JourneyTimes {...times} />
        <StatusBadge {...statuses.journeyStatus(journey)} />
        {journey.trips?.map((leg, index) => {
          const stop = reports[index]?.stops?.find((item) => item.code === leg.depart_from_code);
          const platform = stop?.track_actual || stop?.track_scheduled;
          return (
            <View key={`${leg.number}-${index}`} style={styles.leg}>
              <LineBadge code={leg.line} />
              <View style={styles.names}>
                <Text style={styles.service}>{leg.display}</Text>
                {platform && !['-', '--'].includes(platform.trim()) && (
                  <Text style={styles.subtitle}>
                    {index ? 'Transfer boarding' : 'Boarding'} platform {platform}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </Pressable>
      <View style={styles.dismiss}>
        <IconButton name="x" label="Stop tracking trip" onPress={() => trackTrip(null)} />
      </View>
    </Card>
  );
}
