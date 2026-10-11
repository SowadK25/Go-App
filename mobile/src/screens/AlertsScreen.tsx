import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import type { LineSummary } from '../api/generated';
import { useAlerts, useLines } from '../hooks/transitQueries';
import {
  plainText,
  serviceTimestamp,
  canonicalLineCode,
  lineInfo,
  railLines,
} from '../utils/transit';
import { Screen } from '../components/layout/Screen';
import { Card } from '../components/ui/Card';
import { LineBadge } from '../components/ui/LineBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RequestState } from '../components/RequestState';
import { styles } from './screens.styles';
import { LinePicker } from '../components/transit/LinePicker';
import { Icon } from '../components/ui/Icon';
import { ActionButton } from '../components/ui/ActionButton';
import { styles as lineStyles } from '../components/transit/LinePicker.styles';
import { filterAlertsByLines } from '../utils/alerts';
export function AlertsScreen({
  header = true,
  initialLineCodes,
}: {
  header?: boolean;
  initialLineCodes?: string[];
}) {
  const alerts = useAlerts();
  const lines = useLines();
  const [selectedCodes, setSelectedCodes] = useState<string[]>(initialLineCodes ?? []);
  useEffect(() => {
    setSelectedCodes(initialLineCodes ?? []);
  }, [initialLineCodes]);
  const [showLinePicker, setShowLinePicker] = useState(false);
  const allNotices = useMemo(
    () => [...(alerts.data?.service_alerts ?? []), ...(alerts.data?.information_alerts ?? [])],
    [alerts.data],
  );
  const lineOptions = useMemo(() => {
    const catalog = new Map<string, LineSummary>();
    for (const line of lines.data?.lines ?? []) catalog.set(canonicalLineCode(line.code), line);
    // Train lines can have alerts even on days without scheduled service.
    for (const line of railLines)
      if (!catalog.has(line.code))
        catalog.set(line.code, {
          code: line.code,
          name: line.name,
          vehicle_types: ['Train'],
        });
    for (const alert of allNotices)
      for (const code of alert.affected_lines ?? []) {
        const key = canonicalLineCode(code);
        if (!catalog.has(key))
          catalog.set(key, {
            code,
            name: lineInfo(code)?.name ?? `Line ${code}`,
            vehicle_types: /^\d+$/.test(code) ? ['Bus'] : [],
          });
      }
    return [...catalog.values()];
  }, [lines.data, allNotices]);
  const notices = filterAlertsByLines(allNotices, selectedCodes);
  const selectedLine =
    selectedCodes.length === 1
      ? lineOptions.find(
          (line) => canonicalLineCode(line.code) === canonicalLineCode(selectedCodes[0]),
        )
      : undefined;
  const filterName =
    selectedCodes.length > 1
      ? 'Tracked trip lines'
      : (selectedLine?.name ??
        (selectedCodes.length
          ? (lineInfo(selectedCodes[0])?.name ?? `Line ${selectedCodes[0]}`)
          : 'All Lines'));
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
      <Card>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter alerts by line"
          style={lineStyles.trigger}
          onPress={() => setShowLinePicker(true)}
        >
          {selectedCodes.length ? (
            <View style={styles.wrap}>
              {selectedCodes.map((code) => (
                <LineBadge key={code} code={code} />
              ))}
            </View>
          ) : (
            <Icon name="filter" />
          )}
          <View style={lineStyles.details}>
            <Text style={lineStyles.name}>{filterName}</Text>
            <Text style={lineStyles.mode}>Choose a train or bus line</Text>
          </View>
          <Icon name="chevron-down" size={18} />
        </Pressable>
        {selectedCodes.length > 0 && (
          <ActionButton title="Show All Lines" secondary onPress={() => setSelectedCodes([])} />
        )}
        {alerts.data && (
          <Text style={styles.subtitle}>
            {notices.length} update{notices.length === 1 ? '' : 's'}
            {selectedCodes.length ? ` for ${filterName}` : ' across all lines'}
          </Text>
        )}
      </Card>
      <LinePicker
        lines={lineOptions}
        selectedCode={selectedCodes.length === 1 ? selectedCodes[0] : undefined}
        visible={showLinePicker}
        onClose={() => setShowLinePicker(false)}
        onSelect={(line) => setSelectedCodes([line.code])}
        availabilityLabel="to filter"
      />
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
                  : selectedCodes.length
                    ? `No service or information alerts were reported for ${filterName}.`
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
