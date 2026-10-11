import { Text, View } from 'react-native';
import { serviceTime } from '../../utils/transit';
import { timeDifference } from '../../utils/stopTimes';
import { styles } from './StopTime.styles';

export function StopTime({
  scheduled,
  estimated,
}: {
  scheduled?: string | null;
  estimated?: string | null;
}) {
  const difference = timeDifference(scheduled, estimated);
  const changed =
    !!scheduled &&
    !!estimated &&
    (difference === null ? serviceTime(scheduled) !== serviceTime(estimated) : difference !== 0);
  if (!changed) return <Text style={styles.time}>{serviceTime(estimated || scheduled)}</Text>;
  const label = `Scheduled ${serviceTime(scheduled)}; estimated ${serviceTime(estimated)}${difference !== null ? (difference > 0 ? ', late' : ', early') : ''}`;
  return (
    <View style={styles.times} accessible accessibilityLabel={label}>
      <Text style={styles.time}>{serviceTime(scheduled)}</Text>
      <Text style={styles.arrow} accessible={false}>
        →
      </Text>
      <Text
        style={[styles.time, difference !== null && (difference > 0 ? styles.late : styles.early)]}
      >
        {serviceTime(estimated)}
      </Text>
    </View>
  );
}
