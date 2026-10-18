import { ActivityIndicator, Text } from 'react-native';
import { MotionPressable } from './MotionPressable';
import { Icon, type IconName } from './Icon';
import { styles } from './ui.styles';
import { colors } from '../../theme/tokens';
export function ActionButton({
  title,
  onPress,
  icon,
  secondary = false,
  destructive = false,
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  const foreground = destructive ? colors.danger : secondary ? colors.primary : colors.surface;
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        secondary && styles.secondary,
        destructive && styles.destructive,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        icon && <Icon name={icon} size={17} color={foreground} />
      )}
      <Text
        style={[
          styles.actionText,
          secondary && styles.secondaryText,
          destructive && styles.destructiveText,
        ]}
      >
        {title}
      </Text>
    </MotionPressable>
  );
}
