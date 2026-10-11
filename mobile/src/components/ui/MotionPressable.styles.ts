import type { Animated } from 'react-native';
export function pressMotionStyle(scale: Animated.Value) {
  return { transform: [{ scale }] };
}
