import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../../navigation/types';
import { IconButton } from '../ui/IconButton';
import { styles } from '../ui/ui.styles';
import { colors } from '../../theme/tokens';
export function AppHeader() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  return (
    <View style={styles.header}>
      <IconButton
        name="menu"
        label="Saved stations and preferences"
        color={colors.surface}
        onPress={() => navigation.navigate('Preferences')}
      />
      <View style={styles.brand} accessibilityLabel="GO Transit">
        <View style={styles.brandMark}>
          <Text style={styles.brandSymbol}>∞</Text>
        </View>
        <View>
          <Text style={styles.brandName}>GO</Text>
          <Text style={styles.brandSubtitle}>Transit</Text>
        </View>
      </View>
      <IconButton
        name="bell"
        label="Service alerts"
        color={colors.surface}
        onPress={() => navigation.navigate('Alerts')}
      />
    </View>
  );
}
