import { Text, View } from 'react-native';
import { lineInfo } from '../../utils/transit';
import { styles, badgeColor } from './ui.styles';
import { colors } from '../../theme/tokens';
export function LineBadge({ code }: { code: string }) {
  return (
    <View style={[styles.badge, badgeColor(lineInfo(code)?.color ?? colors.primary)]}>
      <Text style={styles.badgeText}>{lineInfo(code)?.code ?? code}</Text>
    </View>
  );
}
