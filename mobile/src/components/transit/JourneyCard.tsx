import { Pressable, Text, View } from 'react-native';
import type { JourneyService } from '../../api/generated';
import { serviceTime, journeyDuration, vehicleName } from '../../utils/transit';
import { transferCount } from '../../utils/journeys';
import type { LiveTripStatus } from '../../utils/liveStatus';
import type { PredictedTime } from '../../utils/journeyPredictions';
import { JourneyTimes } from './JourneyTimes';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { LineBadge } from '../ui/LineBadge';
import { StatusBadge } from '../ui/StatusBadge';
import { styles } from './JourneyCard.styles';

export function JourneyCard({
  journey,
  stopName,
  onPress,
  status,
  legStatuses,
  departure,
  arrival,
  departureDateLabel,
  arrivalTargetMinutesLate,
}: {
  journey: JourneyService;
  stopName: (code: string) => string;
  onPress: () => void;
  status: LiveTripStatus;
  legStatuses: LiveTripStatus[];
  departure: PredictedTime;
  arrival: PredictedTime;
  departureDateLabel?: string;
  arrivalTargetMinutesLate?: number;
}) {
  const transfers = transferCount(journey);
  return (
    <Card padded={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View trip departing ${serviceTime(journey.start_time)}, ${transfers ? `${transfers} transfers` : 'direct'}, ${status.label}`}
        onPress={onPress}
        style={({ pressed }) => [styles.content, pressed && styles.pressed]}
      >
        {!!departureDateLabel && <Text style={styles.subtitle}>Departs {departureDateLabel}</Text>}
        <View style={styles.timeRow}>
          <JourneyTimes departure={departure} arrival={arrival} />
          <Icon name="chevron-right" size={18} />
        </View>
        <View style={styles.badges}>
          <StatusBadge label={status.label} tone={status.tone} />
          {!!arrivalTargetMinutesLate && (
            <StatusBadge
              label={`Arrives ${arrivalTargetMinutesLate} min after target`}
              tone="warning"
            />
          )}
          {journey.duration && (
            <StatusBadge
              label={`${journeyDuration(journey.duration)}${departure.estimated || arrival.estimated ? ' scheduled' : ''}`}
            />
          )}
          <StatusBadge
            label={transfers ? `${transfers} transfer${transfers > 1 ? 's' : ''}` : 'Direct trip'}
          />
        </View>
        {journey.trips?.map((leg, index) => (
          <View key={`${leg.number}-${index}`} style={styles.leg}>
            <View style={styles.legHeading}>
              <LineBadge code={leg.line} />
              <Text style={styles.label}>{leg.display}</Text>
            </View>
            <Text style={styles.subtitle}>
              {vehicleName(leg.vehicle_type)} · {stopName(leg.depart_from_code)} →{' '}
              {stopName(leg.destination_stop_code)}
            </Text>
            {(journey.trips?.length ?? 0) > 1 && legStatuses[index] && (
              <StatusBadge label={legStatuses[index].label} tone={legStatuses[index].tone} />
            )}
          </View>
        ))}
        <Text style={styles.link}>View stops & times</Text>
      </Pressable>
    </Card>
  );
}
