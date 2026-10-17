import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../../navigation/types';
import { useAlerts } from '../../hooks/transitQueries';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { RequestState } from '../RequestState';
import { styles } from './transit.styles';
export function ServiceAlertSummary() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const alerts = useAlerts();
  const count = alerts.data?.service_alerts.length ?? 0;
  return (
    <Card>
      {alerts.isError ? (
        <RequestState
          message={alerts.error.message}
          onRetry={() => {
            void alerts.refetch();
          }}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          style={styles.alertHeader}
          onPress={() => navigation.navigate('Alerts')}
        >
          <View style={styles.iconCircle}>
            <Icon
              name={
                count || alerts.data?.unavailable_lines?.length ? 'alert-circle' : 'check-circle'
              }
            />
          </View>
          <View style={styles.grow}>
            <Text style={styles.title}>
              {!alerts.data
                ? 'Checking service alerts...'
                : alerts.data.unavailable_lines?.length
                  ? 'Some service alerts unavailable'
                  : count
                    ? `${count} Service Notice${count > 1 ? 's' : ''}`
                    : 'No Reported Service Alerts'}
            </Text>
            <Text style={styles.subtitle}>
              {count
                ? 'Review updates before you travel.'
                : 'View the latest GO Transit and UP Express information.'}
            </Text>
          </View>
          <Icon name="chevron-right" size={16} />
        </Pressable>
      )}
    </Card>
  );
}
