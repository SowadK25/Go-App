import { Pressable } from 'react-native';
import { Icon, type IconName } from './Icon';
import { styles } from './ui.styles';
import { colors } from '../../theme/tokens';
export function IconButton({
  name,
  label,
  onPress,
  color = colors.primary,
  disabled = false,
  selected,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Icon name={name} color={color} />
    </Pressable>
  );
}
