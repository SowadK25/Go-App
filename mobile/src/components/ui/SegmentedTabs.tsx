import { Pressable, Text, View } from 'react-native';
import { styles } from './SegmentedTabs.styles';

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="tab"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          style={[styles.tab, value === option.value && styles.selected]}
        >
          <Text style={[styles.label, value === option.value && styles.selectedLabel]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
