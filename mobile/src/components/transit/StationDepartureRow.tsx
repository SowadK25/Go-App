import { Text, View } from 'react-native';
import type { NextServiceLine, StationDeparture } from '../../api/generated';
import { vehicleName, serviceTime } from '../../utils/transit';
import { MotionPressable } from '../ui/MotionPressable';
import { Card } from '../ui/Card';
import { LineBadge } from '../ui/LineBadge';
import { Icon } from '../ui/Icon';
import { StopTime } from './StopTime';
import { StatusBadge } from '../ui/StatusBadge';
import { styles } from './StationDepartureRow.styles';

export function StationDepartureRow({
  departure,
  prediction,
  onPress,
}: {
  departure: StationDeparture;
  prediction?: NextServiceLine;
  onPress: () => void;
}) {
  return (
    <Card padded={false}>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={`View ${vehicleName(departure.service_type).toLowerCase()} to ${departure.destination} departing ${serviceTime(departure.scheduled_departure_time)}`}
        onPress={onPress}
        style={({ pressed }) => [styles.content, pressed && styles.pressed]}
      >
        <StopTime
          scheduled={departure.scheduled_departure_time}
          estimated={prediction?.computed_departure_time}
          prominent
        />
        <View style={styles.heading}>
          <LineBadge code={departure.line_code} />
          <Text style={styles.destination}>{departure.destination}</Text>
          <Icon name="chevron-right" size={18} />
        </View>
        {(prediction?.status === 'Cancelled' || prediction?.departure_status === 'Skipped') && (
          <StatusBadge
            label={prediction.status === 'Cancelled' ? 'Cancelled' : 'Stop skipped'}
            tone="danger"
          />
        )}
        <View style={styles.notes}>
          <Text style={styles.note}>
            {vehicleName(departure.service_type)} - Trip {departure.trip_number}
          </Text>
          {!!prediction?.platform_number && (
            <Text style={styles.note}>Platform {prediction.platform_number}</Text>
          )}
        </View>
      </MotionPressable>
    </Card>
  );
}
