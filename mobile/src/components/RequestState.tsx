import { ActivityIndicator, Text, View } from 'react-native';
import { styles } from './ui/ui.styles';
import { ActionButton } from './ui/ActionButton';
import { colors } from '../theme/tokens';

export function RequestState({
  message,
  loading = false,
  onRetry,
}: {
  message: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.empty}>
      {loading && <ActivityIndicator accessibilityLabel="Loading" color={colors.primary} />}
      <Text accessibilityRole="alert" style={styles.emptyText}>
        {message}
      </Text>
      {onRetry && <ActionButton title="Try again" secondary onPress={onRetry} />}
    </View>
  );
}
