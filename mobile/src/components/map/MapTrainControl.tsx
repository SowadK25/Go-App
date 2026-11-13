import { Switch, Text, View } from 'react-native';
import { colors } from '../../theme/tokens';
import { styles } from './MapTrainControl.styles';

export function MapTrainControl({
  enabled,
  onChange,
  summary,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  summary: string;
}) {
  return (
    <View style={styles.control}>
      <View style={styles.words}>
        <Text style={styles.title}>Live trains</Text>
        <Text style={styles.summary}>{summary}</Text>
      </View>
      <Switch
        accessibilityLabel="Show live GO train positions"
        value={enabled}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </View>
  );
}
