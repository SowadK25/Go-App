import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';
export const styles = StyleSheet.create({
  container: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 6,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  code: { fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  busButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  busLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  modal: { flex: 1, padding: 16, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  bulk: { flexDirection: 'row', gap: 8 },
  bulkButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
  },
  bulkLabel: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  list: { flex: 1 },
  row: {
    minHeight: 60,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  routeName: { flex: 1, color: colors.text, fontSize: 13 },
});

export function chipColors(color: string, selected: boolean) {
  return {
    backgroundColor: selected ? color : colors.surface,
    borderColor: selected ? color : colors.border,
  };
}
export function chipDotColor(color: string, selected: boolean) {
  return { backgroundColor: selected ? colors.surface : color };
}
export function chipTextColor(selected: boolean) {
  return { color: selected ? colors.surface : colors.muted };
}
