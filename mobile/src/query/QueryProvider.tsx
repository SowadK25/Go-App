import { useEffect, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ApiError } from '../api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: (count, error) =>
        count < 1 &&
        !(
          error instanceof ApiError &&
          (error.status === undefined ||
            (error.status >= 400 && error.status < 500) ||
            error.status === 503)
        ),
    },
  },
});

export function QueryProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) =>
      focusManager.setFocused(state === 'active'),
    );
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => {
        // A LAN API can be reachable even when internet reachability is false.
        setOnline(state.isConnected !== false);
      }),
    );
    return () => {
      subscription.remove();
      focusManager.setFocused(undefined);
      onlineManager.setEventListener(() => () => {});
    };
  }, []);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
