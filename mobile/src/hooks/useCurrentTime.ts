import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

// A local clock lets cached results expire without making another API request.
export function useCurrentTime(enabled: boolean) {
  const focused = useIsFocused();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled || !focused) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => setNow(new Date());
    const resume = () => {
      if (timer) clearInterval(timer);
      update();
      timer = setInterval(update, 1000);
    };
    if (Platform.OS === 'web' || AppState.currentState === 'active') resume();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') resume();
      else {
        clearInterval(timer);
        timer = undefined;
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [enabled, focused]);
  return now;
}
