import { StyleSheet } from 'react-native';
import { cardShadow, colors, radii } from '../../theme/tokens';
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 28 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    ...cardShadow,
    overflow: 'hidden',
  },
  paddedCard: { padding: 16, gap: 16 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heading: { fontSize: 17, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text, lineHeight: 21 },
  muted: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  link: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.45 },
  action: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  actionText: { color: colors.surface, fontSize: 14, fontWeight: '700' },
  secondary: { backgroundColor: colors.primarySoft },
  secondaryText: { color: colors.primary },
  destructive: { backgroundColor: colors.dangerSoft },
  destructiveText: { color: colors.danger },
  badge: {
    minWidth: 24,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 4,
    alignItems: 'center',
  },
  badgeText: { color: colors.surface, fontSize: 10, fontWeight: '700' },
  status: {
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  statusText: { fontSize: 11, fontWeight: '600', flexShrink: 1 },
  header: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    backgroundColor: colors.primary,
    gap: 8,
  },
  empty: { padding: 24, gap: 12, alignItems: 'center' },
  emptyCompact: { paddingHorizontal: 0, paddingVertical: 8, gap: 8, alignItems: 'flex-start' },
  emptyCompactText: { textAlign: 'left' },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
export const badgeColor = (color: string) => ({ backgroundColor: color });
export const statusColors = (tone: 'success' | 'warning' | 'neutral' | 'danger') => ({
  backgroundColor:
    tone === 'success'
      ? colors.successSoft
      : tone === 'warning'
        ? colors.warningSoft
        : tone === 'danger'
          ? colors.dangerSoft
          : colors.field,
});
export const statusTextColor = (tone: 'success' | 'warning' | 'neutral' | 'danger') => ({
  color:
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'danger'
          ? colors.danger
          : colors.muted,
});
