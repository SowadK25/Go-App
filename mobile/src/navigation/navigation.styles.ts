import { StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';
export const styles = StyleSheet.create({
  tabBar: { borderTopColor: colors.border, backgroundColor: colors.surface },
  tabLabel: { fontSize: 10, fontWeight: '600' },
  stackHeader: { backgroundColor: colors.primary },
});
export const stackOptions = {
  headerStyle: styles.stackHeader,
  headerTintColor: colors.surface,
  headerShadowVisible: false,
};
export const tabOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: styles.tabBar,
  tabBarLabelStyle: styles.tabLabel,
};
