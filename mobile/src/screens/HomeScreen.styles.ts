import { StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';
export const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 24 },
  hero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 68, gap: 6 },
  heroDate: { color: '#DAE5D4', fontSize: 12, fontWeight: '600' },
  heroTitle: { color: colors.surface, fontSize: 27, lineHeight: 35, fontWeight: '800' },
  body: { paddingHorizontal: 16, marginTop: -42, gap: 16 },
  quickActions: { flexDirection: 'row', gap: 12 },
  grow: { flex: 1 },
});
