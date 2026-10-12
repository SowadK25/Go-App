import { Text, View } from 'react-native';
import { LineBadge } from './LineBadge';
import { styles } from './NamedLineBadge.styles';

export function NamedLineBadge({ code, name }: { code: string; name: string }) {
  return (
    <View style={styles.container} accessible accessibilityLabel={`Route ${code}, ${name}`}>
      <LineBadge code={code} />
      <Text style={styles.name}>{name}</Text>
    </View>
  );
}
