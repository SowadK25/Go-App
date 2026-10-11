import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from './src/query/QueryProvider';
import { PreferencesProvider } from './src/storage/PreferencesProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { MotionProvider } from './src/motion/MotionProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <PreferencesProvider>
          <MotionProvider>
            <AppNavigator />
          </MotionProvider>
        </PreferencesProvider>
        <StatusBar style="light" />
      </QueryProvider>
    </SafeAreaProvider>
  );
}
