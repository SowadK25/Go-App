import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';
export const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, borderRadius: 16 },
  pressed: { backgroundColor: colors.field },
  dismiss: { position: 'absolute', top: 8, right: 8 },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 40,
    minHeight: 28,
  },
  route: { color: colors.text, fontWeight: '700', fontSize: 16 },
  subtitle: { color: colors.muted, fontSize: 12 },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  names: { flex: 1, gap: 4 },
  service: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
