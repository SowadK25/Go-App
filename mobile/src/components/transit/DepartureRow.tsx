import { Pressable, Text, View } from 'react-native';
import { Icon } from '../ui/Icon';
import { LineBadge } from '../ui/LineBadge';
import { StatusBadge } from '../ui/StatusBadge';
import { serviceTime } from '../../utils/transit';
import { styles } from './transit.styles';
export function DepartureRow({
  time,
  destination,
  lineCode,
  platform,
  status,
  scheduled,
  origin,
  onPress,
}: {
  time: string;
  destination: string;
  lineCode?: string;
  platform?: string | null;
  status?: string | null;
  scheduled?: string | null;
  origin?: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.between}>
        <Text style={styles.departureTime}>{serviceTime(time)}</Text>
        {!!status && <StatusBadge label={status} />}
      </View>
      <View style={styles.row}>
        {lineCode && <LineBadge code={lineCode} />}
        <View style={styles.departureDetails}>
          <Text style={styles.title}>{destination}</Text>
          {!!origin && <Text style={styles.subtitle}>From {origin}</Text>}
          {!!platform && <Text style={styles.subtitle}>Platform {platform}</Text>}
          {!!scheduled && scheduled !== time && (
            <Text style={styles.subtitle}>Scheduled {serviceTime(scheduled)}</Text>
          )}
        </View>
      </View>
      {onPress && (
        <View style={styles.between}>
          <Text style={styles.link}>View stops & times</Text>
          <Icon name="chevron-right" size={16} />
        </View>
      )}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View trip to ${destination} departing ${serviceTime(time)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.departure, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.departure}>{content}</View>
  );
}
