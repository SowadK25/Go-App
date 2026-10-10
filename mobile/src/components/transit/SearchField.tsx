import { TextInput, View } from 'react-native';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { styles } from './transit.styles';
import { colors } from '../../theme/tokens';
export function SearchField({
  value,
  onChange,
  placeholder = 'Search stations...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.search}>
      <Icon name="search" color={colors.subtle} size={18} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        placeholderTextColor={colors.muted}
        autoCorrect={false}
      />
      {!!value && <IconButton name="x" label="Clear search" onPress={() => onChange('')} />}
    </View>
  );
}
