import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../../navigation/types';
import { IconButton } from '../ui/IconButton';
import { Brand } from '../ui/Brand';
import { styles } from '../ui/ui.styles';
import { colors } from '../../theme/tokens';
import { usePreferences } from '../../storage/PreferencesProvider';
import { trackingExpired } from '../../storage/preferences';
import { useAlerts } from '../../hooks/transitQueries';
import { filterAlertsByLines, journeyLineCodes } from '../../utils/alerts';
import { styles as headerStyles } from './AppHeader.styles';
export function AppHeader() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { trackedTrip } = usePreferences();
  const lineCodes =
    trackedTrip && !trackingExpired(trackedTrip) ? journeyLineCodes(trackedTrip.journey) : [];
  const alerts = useAlerts(undefined, lineCodes.length > 0);
  const count =
    alerts.data && !alerts.isError && alerts.fetchStatus !== 'paused'
      ? filterAlertsByLines(
          [...alerts.data.service_alerts, ...alerts.data.information_alerts],
          lineCodes,
        ).length
      : null;
  const label = lineCodes.length
    ? count === null
      ? 'Alerts for tracked trip; count unavailable'
      : `${count} alert${count === 1 ? '' : 's'} for tracked trip`
    : 'Service alerts';
  return (
    <View style={styles.header}>
      <IconButton
        name="sliders"
        label="Station preferences"
        color={colors.surface}
        onPress={() => navigation.navigate('Preferences')}
      />
      <Brand />
      <View style={headerStyles.alertButton}>
        <IconButton
          name="bell"
          label={label}
          color={colors.surface}
          onPress={() =>
            navigation.navigate('Alerts', lineCodes.length ? { lineCodes } : undefined)
          }
        />
        {lineCodes.length > 0 && count !== null && (
          <View pointerEvents="none" style={headerStyles.badge} accessible={false}>
            <Text style={headerStyles.badgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
