import { Text, View } from 'react-native';
import type { PredictedTime } from '../../utils/journeyPredictions';
import { timeDifference } from '../../utils/stopTimes';
import { serviceTime } from '../../utils/transit';
import { StopTime } from './StopTime';
import { styles } from './JourneyTimes.styles';

export function JourneyTimes({
  departure,
  arrival,
}: {
  departure: PredictedTime;
  arrival: PredictedTime;
}) {
  const changed = [departure, arrival].some(
    (pair) =>
      pair.estimated &&
      pair.scheduled &&
      (timeDifference(pair.scheduled, pair.estimated) ??
        (serviceTime(pair.scheduled) !== serviceTime(pair.estimated) ? 1 : 0)) !== 0,
  );
  if (!changed)
    return (
      <Text style={styles.unchanged}>
        {serviceTime(departure.estimated || departure.scheduled)} →{' '}
        {serviceTime(arrival.estimated || arrival.scheduled)}
      </Text>
    );
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Departure</Text>
        <StopTime {...departure} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Arrival</Text>
        <StopTime {...arrival} />
      </View>
    </View>
  );
}
