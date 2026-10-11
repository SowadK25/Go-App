import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';
export const styles = StyleSheet.create({
  alertButton: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.surface, fontSize: 10, fontWeight: '700' },
});
