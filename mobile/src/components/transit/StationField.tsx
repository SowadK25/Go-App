import { Pressable, Text, View } from 'react-native';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { styles } from './StationField.styles';

export function StationField({
  kind,
  name,
  onSelect,
  onClear,
}: {
  kind: 'origin' | 'destination';
  name?: string;
  onSelect: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.field}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose ${kind} station`}
        style={styles.selection}
        onPress={onSelect}
      >
        <View style={[styles.dot, styles[kind]]} />
        <Text numberOfLines={1} style={[styles.name, !name && styles.placeholder]}>
          {name || (kind === 'origin' ? 'From station' : 'To station')}
        </Text>
        <Icon name="chevron-down" size={16} />
      </Pressable>
      {!!name && <IconButton name="x" label={`Clear ${kind} station`} onPress={onClear} />}
    </View>
  );
}
