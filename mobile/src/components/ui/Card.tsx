import { View, type ViewProps } from 'react-native';
import { styles } from './ui.styles';
export function Card({
  children,
  style,
  padded = true,
  ...props
}: ViewProps & { padded?: boolean }) {
  return (
    <View style={[styles.card, padded && styles.paddedCard, style]} {...props}>
      {children}
    </View>
  );
}
