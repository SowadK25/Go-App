import { Text } from 'react-native';
import { MotionPressable } from '../ui/MotionPressable';
import { LineBadge } from '../ui/LineBadge';
import { styles } from './transit.styles';
export function ChoiceChip({
  label,
  selected,
  onPress,
  lineCode,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  lineCode?: string;
}) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.selectedChip]}
    >
      {lineCode && <LineBadge code={lineCode} />}
      <Text style={[styles.chipText, selected && styles.selectedChipText]}>{label}</Text>
    </MotionPressable>
  );
}
