import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';

export const styles = StyleSheet.create({
  field: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 4,
  },
  selection: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: colors.text, fontSize: 13 },
  placeholder: { color: colors.muted },
  dot: { width: 8, height: 8, borderRadius: 4 },
  origin: { backgroundColor: colors.primary },
  destination: { backgroundColor: colors.danger },
});
