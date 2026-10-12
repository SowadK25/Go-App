import { Text, View } from 'react-native';
import { serviceTime } from '../../utils/transit';
import { timeDifference } from '../../utils/stopTimes';
import { styles } from './StopTime.styles';

export function StopTime({
  scheduled,
  estimated,
  prominent = false,
}: {
  scheduled?: string | null;
  estimated?: string | null;
  prominent?: boolean;
}) {
  const difference = timeDifference(scheduled, estimated);
  const changed =
    !!scheduled &&
    !!estimated &&
    (difference === null ? serviceTime(scheduled) !== serviceTime(estimated) : difference !== 0);
  if (!changed)
    return (
      <Text style={[styles.time, prominent && styles.prominent]}>
        {serviceTime(estimated || scheduled)}
      </Text>
    );
  const label = `Scheduled ${serviceTime(scheduled)}; estimated ${serviceTime(estimated)}${difference !== null ? (difference > 0 ? ', late' : ', early') : ''}`;
  return (
    <View
      style={[styles.times, prominent && styles.prominentTimes]}
      accessible
      accessibilityLabel={label}
    >
      <Text style={[styles.time, prominent && styles.prominent]}>{serviceTime(scheduled)}</Text>
      <Text style={[styles.arrow, prominent && styles.prominent]} accessible={false}>
        →
      </Text>
      <Text
        style={[
          styles.time,
          prominent && styles.prominent,
          difference !== null && (difference > 0 ? styles.late : styles.early),
        ]}
      >
        {serviceTime(estimated)}
      </Text>
    </View>
  );
}
