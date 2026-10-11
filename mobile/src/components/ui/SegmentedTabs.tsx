import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { useReducedMotion } from '../../motion/MotionProvider';
import { styles, indicatorStyle } from './SegmentedTabs.styles';

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const position = useRef(new Animated.Value(0)).current;
  const previousStep = useRef(0);
  const tabWidth = options.length
    ? Math.max(0, (width - 8 - (options.length - 1) * 4) / options.length)
    : 0;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const step = tabWidth + 4;
  useEffect(() => {
    position.stopAnimation();
    const target = Math.max(0, selectedIndex) * step;
    if (reducedMotion || previousStep.current !== step || !tabWidth) position.setValue(target);
    else
      Animated.spring(position, {
        toValue: target,
        stiffness: 260,
        damping: 26,
        mass: 0.8,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    previousStep.current = step;
    return () => position.stopAnimation();
  }, [position, reducedMotion, selectedIndex, step, tabWidth]);
  return (
    <View
      accessibilityRole="tablist"
      style={styles.tabs}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {tabWidth > 0 && selectedIndex >= 0 && (
        <Animated.View
          pointerEvents="none"
          accessible={false}
          style={[styles.indicator, indicatorStyle(tabWidth, position)]}
        />
      )}
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="tab"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          style={[styles.tab, !tabWidth && value === option.value && styles.selected]}
        >
          <Text style={[styles.label, value === option.value && styles.selectedLabel]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
