import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import { styles } from './ShortcutCard.styles';

export function ShortcutCard({
  title,
  subtitle,
  icon,
  onPress,
  style,
  showChevron = false,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  showChevron?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Icon name={icon} />
      </View>
      <View style={styles.details}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {showChevron && <Icon name="chevron-right" size={18} />}
    </Pressable>
  );
}
