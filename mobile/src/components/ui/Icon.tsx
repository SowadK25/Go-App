import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { colors } from '../../theme/tokens';
export type IconName = ComponentProps<typeof Feather>['name'] | 'train';
export function Icon({
  name,
  size = 20,
  color = colors.primary,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  if (name === 'train')
    return <Ionicons name="train-outline" size={size} color={color} accessible={false} />;
  return <Feather name={name} size={size} color={color} accessible={false} />;
}
