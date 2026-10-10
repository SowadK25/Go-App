import { ActivityIndicator, Pressable, Text } from 'react-native';
import { Icon, type IconName } from './Icon';
import { styles } from './ui.styles';
import { colors } from '../../theme/tokens';
export function ActionButton({
  title,
  onPress,
  icon,
  secondary = false,
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        secondary && styles.secondary,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.primary : colors.surface} />
      ) : (
        icon && <Icon name={icon} size={17} color={secondary ? colors.primary : colors.surface} />
      )}
      <Text style={[styles.actionText, secondary && styles.secondaryText]}>{title}</Text>
    </Pressable>
  );
}
