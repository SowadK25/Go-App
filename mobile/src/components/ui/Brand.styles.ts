import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';
export const styles = StyleSheet.create({
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 40, height: 40 },
  words: { gap: 2 },
  name: { color: colors.surface, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  tagline: { color: '#E1ECD9', fontSize: 10, fontWeight: '500', letterSpacing: 0.3 },
});
