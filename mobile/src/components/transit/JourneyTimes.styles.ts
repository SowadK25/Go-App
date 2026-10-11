import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: { flex: 1, gap: 8 },
  unchanged: { color: colors.text, fontSize: 21, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
});
