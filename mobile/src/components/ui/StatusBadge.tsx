import { Text, View } from 'react-native';
import { styles, statusColors, statusTextColor } from './ui.styles';
export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'success' | 'warning' | 'neutral';
}) {
  return (
    <View style={[styles.status, statusColors(tone)]}>
      <Text style={[styles.statusText, statusTextColor(tone)]}>{label}</Text>
    </View>
  );
}
