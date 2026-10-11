import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';

export const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  pressed: { opacity: 0.7 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { flex: 1, color: colors.text, fontSize: 21, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  leg: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 6,
  },
  legHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  link: { color: colors.primary, fontSize: 12, fontWeight: '600' },
});
