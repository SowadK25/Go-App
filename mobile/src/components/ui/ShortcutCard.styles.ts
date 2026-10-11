import { StyleSheet } from 'react-native';
import { cardShadow, colors } from '../../theme/tokens';

export const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...cardShadow,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: { flex: 1 },
  title: { color: colors.text, fontSize: 13, fontWeight: '600' },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 4 },
  pressed: { opacity: 0.7 },
});
