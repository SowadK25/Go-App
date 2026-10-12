import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';
export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.field,
    maxWidth: '100%',
  },
  name: { color: colors.text, fontSize: 12, flexShrink: 1 },
});
