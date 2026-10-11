import { StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  controls: { padding: 12, gap: 8 },
  map: { flex: 1, overflow: 'hidden' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    gap: 8,
  },
  caption: { color: colors.muted, fontSize: 11, flex: 1 },
  warning: { color: colors.muted, fontSize: 12, paddingHorizontal: 12, paddingBottom: 8 },
  info: { padding: 16, gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  paragraph: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});
