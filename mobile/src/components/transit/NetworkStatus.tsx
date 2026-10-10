import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../../navigation/types';
import { useAlerts, useLines } from '../../hooks/transitQueries';
import { railLines, canonicalLineCode, checkedTime } from '../../utils/transit';
import { Card } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { LineBadge } from '../ui/LineBadge';
import { StatusBadge } from '../ui/StatusBadge';
import { Icon } from '../ui/Icon';
import { RequestState } from '../RequestState';
import { styles } from './transit.styles';
export function NetworkStatus() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const alerts = useAlerts();
  const lines = useLines();
  const notices = alerts.data?.service_alerts ?? [];
  return (
    <Card padded={false}>
      <View style={styles.panelHeading}>
        <SectionHeading
          title="Network Status"
          action="View alerts ›"
          onAction={() => navigation.navigate('Alerts')}
        />
        {!!alerts.dataUpdatedAt && (
          <Text style={styles.subtitle}>Last checked {checkedTime(alerts.dataUpdatedAt)}</Text>
        )}
      </View>
      {(alerts.isError || lines.isError) && (
        <RequestState
          message={alerts.error?.message ?? lines.error?.message ?? 'Service status unavailable.'}
          onRetry={() => {
            void alerts.refetch();
            void lines.refetch();
          }}
        />
      )}
      {railLines.map((line) => {
        const count = notices.filter((alert) =>
          alert.affected_lines?.some((code) => canonicalLineCode(code) === line.code),
        ).length;
        const scheduledLine = lines.data?.lines?.find(
          (item) => canonicalLineCode(item.code) === line.code,
        );
        const scheduled = !!scheduledLine;
        const label =
          !alerts.data || !lines.data
            ? 'Status unavailable'
            : count
              ? `${count} service notice${count > 1 ? 's' : ''}`
              : scheduled
                ? 'No reported alerts'
                : 'No schedule listed';
        return (
          <Pressable
            key={line.code}
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('Main', {
                screen: 'Schedules',
                params: { lineCode: scheduledLine?.code ?? line.code },
              })
            }
            style={styles.statusRow}
          >
            <View style={styles.row}>
              <LineBadge code={line.code} />
              <Text style={styles.statusLabel}>{line.name}</Text>
              <Icon name="chevron-right" size={16} />
            </View>
            <StatusBadge
              label={label}
              tone={count ? 'warning' : scheduled && alerts.data ? 'success' : 'neutral'}
            />
          </Pressable>
        );
      })}
      <View style={styles.footer}>
        <Text style={styles.note}>
          Service notices and schedules can change. Check departures before travelling.
        </Text>
      </View>
    </Card>
  );
}
