import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from './src/query/QueryProvider';
import { PreferencesProvider } from './src/storage/PreferencesProvider';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <PreferencesProvider>
          <AppNavigator />
        </PreferencesProvider>
        <StatusBar style="light" />
      </QueryProvider>
    </SafeAreaProvider>
  );
}
