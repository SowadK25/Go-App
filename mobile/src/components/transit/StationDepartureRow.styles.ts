import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';
export const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  pressed: { backgroundColor: colors.field },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  destination: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  notes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  note: { color: colors.muted, fontSize: 12 },
});
