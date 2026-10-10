import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PropsWithChildren } from 'react';
import { AppHeader } from './AppHeader';
import { styles } from '../ui/ui.styles';
export function Screen({
  children,
  scroll = true,
  header = true,
  ...props
}: PropsWithChildren<ScrollViewProps & { scroll?: boolean; header?: boolean }>) {
  return (
    <SafeAreaView style={styles.safe} edges={header ? ['top'] : []}>
      {header && <AppHeader />}
      {scroll ? (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          {...props}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.screen}>{children}</View>
      )}
    </SafeAreaView>
  );
}
