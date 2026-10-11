import { Text, View } from 'react-native';
import type { ReactNode } from 'react';
import type { JourneyStop } from '../../api/generated';
import { serviceTime } from '../../utils/transit';
import { styles } from './StopTimeline.styles';

export function StopTimeline({
  stops,
  stopName,
  renderNotes,
  renderTime,
}: {
  stops: JourneyStop[];
  stopName: (code: string) => string;
  renderNotes?: (stop: JourneyStop, index: number) => ReactNode;
  renderTime?: (stop: JourneyStop, index: number) => ReactNode;
}) {
  return (
    <View>
      {stops.map((stop, index) => {
        const first = index === 0;
        const last = index === stops.length - 1;
        return (
          <View key={`${stop.code}-${index}`} style={styles.row}>
            <View style={styles.track}>
              <View style={[styles.dot, (first || last) && styles.endpoint]} />
              {!last && <View style={styles.connector} />}
            </View>
            <View style={styles.details}>
              <View style={styles.heading}>
                <Text style={styles.name}>{stopName(stop.code)}</Text>
                {renderTime ? (
                  renderTime(stop, index)
                ) : (
                  <Text style={styles.time}>{serviceTime(stop.time)}</Text>
                )}
              </View>
              <Text style={styles.caption}>
                {first ? 'Board here' : last ? 'Get off here' : 'Intermediate stop'}
              </Text>
              {renderNotes?.(stop, index)}
            </View>
          </View>
        );
      })}
    </View>
  );
}
