import { Image, Text, View } from 'react-native';
import { styles } from './Brand.styles';

export function Brand() {
  return (
    <View style={styles.brand} accessible accessibilityLabel="Unionbound. Your GO Transit commute.">
      <Image
        source={require('../../../assets/brand/transitflow-mark.png')}
        style={styles.mark}
        accessible={false}
      />
      <View style={styles.words}>
        <Text style={styles.name}>Unionbound</Text>
        <Text style={styles.tagline}>Your GO Transit commute.</Text>
      </View>
    </View>
  );
}
