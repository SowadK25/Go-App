import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';

export const styles = StyleSheet.create({
  times: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 4,
    maxWidth: '50%',
  },
  time: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  arrow: { color: colors.muted, fontSize: 13 },
  late: { color: colors.danger },
  early: { color: colors.success },
});
