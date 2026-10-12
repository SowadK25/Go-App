import { Image, Text, View } from 'react-native';
import { styles } from './Brand.styles';

export function Brand() {
  return (
    <View style={styles.brand} accessible accessibilityLabel="TransitFlow">
      <Image
        source={require('../../../assets/brand/transitflow-mark.png')}
        style={styles.mark}
        accessible={false}
      />
      <View style={styles.words}>
        <Text style={styles.name}>TransitFlow</Text>
        <Text style={styles.tagline}>Plan. Ride. Arrive.</Text>
      </View>
    </View>
  );
}
