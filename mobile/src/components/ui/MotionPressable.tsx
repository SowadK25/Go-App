import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, type PressableProps } from 'react-native';
import { useReducedMotion } from '../../motion/MotionProvider';
import { pressMotionStyle } from './MotionPressable.styles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MotionPressable({
  style,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: PressableProps) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    if (disabled || reducedMotion) {
      scale.stopAnimation();
      scale.setValue(1);
      setPressed(false);
    }
    return () => scale.stopAnimation();
  }, [disabled, reducedMotion, scale]);
  const animate = (down: boolean) => {
    setPressed(down);
    scale.stopAnimation();
    if (reducedMotion || disabled) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, {
      toValue: down ? 0.97 : 1,
      stiffness: 320,
      damping: 24,
      mass: 0.6,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      style={[typeof style === 'function' ? style({ pressed }) : style, pressMotionStyle(scale)]}
      onPressIn={(event) => {
        animate(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animate(false);
        onPressOut?.(event);
      }}
    />
  );
}
