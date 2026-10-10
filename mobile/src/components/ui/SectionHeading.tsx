import { Pressable, Text, View } from 'react-native';
import { styles } from './ui.styles';
export function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.headingRow}>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      {action && onAction && (
        <Pressable accessibilityRole="button" onPress={onAction}>
          <Text style={styles.link}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}
