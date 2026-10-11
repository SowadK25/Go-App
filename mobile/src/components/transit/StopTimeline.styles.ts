import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, minHeight: 54 },
  track: { width: 16, alignItems: 'center' },
  dot: {
    width: 10,
    height: 10,
    marginTop: 5,
    borderRadius: 5,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  endpoint: { backgroundColor: colors.primary },
  connector: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 3 },
  details: { flex: 1, paddingBottom: 16, gap: 4 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  time: { color: colors.text, fontSize: 13, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 11 },
});
