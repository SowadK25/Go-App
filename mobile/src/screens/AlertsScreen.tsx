import { RefreshControl, Text, View } from 'react-native';
import { useAlerts } from '../hooks/transitQueries';
import { plainText, serviceTimestamp } from '../utils/transit';
import { Screen } from '../components/layout/Screen';
import { Card } from '../components/ui/Card';
import { LineBadge } from '../components/ui/LineBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RequestState } from '../components/RequestState';
import { styles } from './screens.styles';
export function AlertsScreen({ header = true }: { header?: boolean }) {
  const alerts = useAlerts();
  const notices = [
    ...(alerts.data?.service_alerts ?? []),
    ...(alerts.data?.information_alerts ?? []),
  ];
  return (
    <Screen
      header={header}
      refreshControl={
        <RefreshControl
          refreshing={alerts.isRefetching}
          onRefresh={() => {
            void alerts.refetch();
          }}
        />
      }
    >
      <Text accessibilityRole="header" style={styles.title}>
        Service Alerts
      </Text>
      <Text style={styles.subtitle}>The latest service and station updates for GO Transit.</Text>
      {alerts.isError && (
        <RequestState
          message={`${alerts.error.message}${alerts.data ? ' Showing the last loaded updates.' : ''}`}
          onRetry={() => {
            void alerts.refetch();
          }}
        />
      )}
      {alerts.fetchStatus === 'paused' && (
        <Text style={styles.subtitle}>You are offline. Updates may be outdated.</Text>
      )}
      {!notices.length && (
        <Card>
          <RequestState
            loading={alerts.isPending && alerts.fetchStatus === 'fetching'}
            message={
              alerts.isPending
                ? 'Checking service updates...'
                : alerts.isError
                  ? 'Updates unavailable.'
                  : 'No service or information alerts were reported.'
            }
          />
        </Card>
      )}
      {notices.map((alert) => (
        <Card key={`${alert.alert_type}-${alert.code}`}>
          <View style={styles.wrap}>
            <StatusBadge
              label={alert.alert_type}
              tone={alert.alert_type === 'Service' ? 'warning' : 'neutral'}
            />
            {alert.affected_lines?.map((code) => (
              <LineBadge key={code} code={code} />
            ))}
          </View>
          <Text style={styles.label}>{plainText(alert.title)}</Text>
          <Text style={styles.alertBody}>{plainText(alert.body)}</Text>
          {!!alert.posted_at && (
            <Text style={styles.updated}>{serviceTimestamp(alert.posted_at)}</Text>
          )}
        </Card>
      ))}
    </Screen>
  );
}
