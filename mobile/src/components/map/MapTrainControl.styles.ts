import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';

export const styles = StyleSheet.create({
  control: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  words: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 12, fontWeight: '600' },
  summary: { color: colors.muted, fontSize: 11 },
});
