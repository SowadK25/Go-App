import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';

export const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  selected: { backgroundColor: colors.primary },
  label: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  selectedLabel: { color: colors.surface },
});
