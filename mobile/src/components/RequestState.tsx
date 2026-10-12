import { ActivityIndicator, Text, View } from 'react-native';
import { styles } from './ui/ui.styles';
import { ActionButton } from './ui/ActionButton';
import { colors } from '../theme/tokens';

export function RequestState({
  message,
  loading = false,
  onRetry,
  compact = false,
}: {
  message: string;
  loading?: boolean;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.empty, compact && styles.emptyCompact]}>
      {loading && <ActivityIndicator accessibilityLabel="Loading" color={colors.primary} />}
      <Text
        accessibilityRole="alert"
        style={[styles.emptyText, compact && styles.emptyCompactText]}
      >
        {message}
      </Text>
      {onRetry && <ActionButton title="Try again" secondary onPress={onRetry} />}
    </View>
  );
}
