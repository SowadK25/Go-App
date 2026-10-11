import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';

export const styles = StyleSheet.create({
  note: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  details: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 13, fontWeight: '600' },
  price: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
