import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import { transitApi } from '../api/transit';
import { Screen } from '../components/layout/Screen';
import { SelectionModal } from '../components/layout/SelectionModal';
import { MapLineFilters } from '../components/map/MapLineFilters';
import { MapTrainControl } from '../components/map/MapTrainControl';
import { TransitMap } from '../components/map/TransitMap';
import type { MapFilter } from '../components/map/mapTypes';
import { SearchField } from '../components/transit/SearchField';
import { IconButton } from '../components/ui/IconButton';
import { RequestState } from '../components/RequestState';
import { visibleMapLines, visibleMapStops, toggleMapLine } from '../utils/networkMap';
import { serviceDate, torontoDateTime, checkedTime } from '../utils/transit';
import { styles } from './SystemMapScreen.styles';
import { useMapTrains } from '../hooks/useMapTrains';
import { useReducedMotion } from '../motion/MotionProvider';
import { colors } from '../theme/tokens';

export function SystemMapScreen({
  navigation,
}: NativeStackScreenProps<RootStackParams, 'SystemMap'>) {
  const focused = useIsFocused();
  const network = useQuery({
    queryKey: ['networkMap'],
    queryFn: ({ signal }) => transitApi.networkMap(signal),
    staleTime: 86400000,
    enabled: focused,
    subscribed: focused,
    retry: false,
  });
  const [hiddenSelection, setHiddenLineCodes] = useState<string[] | null>(null);
  const defaultHidden = useMemo(
    () =>
      network.data?.lines.filter((line) => line.vehicle_type === 'Bus').map((line) => line.code) ??
      [],
    [network.data],
  );
  const hiddenLineCodes = hiddenSelection ?? defaultHidden;
  const [search, setSearch] = useState('');
  const [info, setInfo] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [showTrains, setShowTrains] = useState(true);
  const reducedMotion = useReducedMotion();
  const filter = useMemo<MapFilter>(
    () => ({ mode: 'all', hiddenLineCodes, search }),
    [hiddenLineCodes, search],
  );
  const trains = useMapTrains(network.data, filter, showTrains);
  const positionsUnavailable =
    trains.isError || trains.fetchStatus === 'paused' || trains.data?.available === false;
  const trainSummary = !showTrains
    ? 'Off'
    : !trains.hasVisibleLines
      ? 'No GO lines shown'
      : positionsUnavailable
        ? 'Unavailable'
        : trains.isFetching
          ? 'Updating...'
          : !trains.trains.length && trains.reportsExpired
            ? 'Refresh needed'
            : `${trains.trains.length} GO train${trains.trains.length === 1 ? '' : 's'}`;
  const selectLine = (code: string) => {
    const line = network.data?.lines.find((item) => item.code === code);
    if (line) {
      setHiddenLineCodes(
        network.data?.lines.filter((item) => item.code !== code).map((item) => item.code) ?? [],
      );
    }
  };
  return (
    <Screen header={false} scroll={false}>
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <View style={styles.controls}>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Find a station on the map..."
          />
          <View style={styles.controlRow}>
            <View style={styles.routeControl}>
              <MapLineFilters
                lines={network.data?.lines ?? []}
                hiddenCodes={hiddenLineCodes}
                onToggle={(code) =>
                  setHiddenLineCodes((current) => toggleMapLine(current ?? defaultHidden, code))
                }
                onSetVisible={(codes, visible) =>
                  setHiddenLineCodes((current) =>
                    visible
                      ? (current ?? defaultHidden).filter((code) => !codes.includes(code))
                      : [...new Set([...(current ?? defaultHidden), ...codes])],
                  )
                }
              />
            </View>
            <MapTrainControl enabled={showTrains} onChange={setShowTrains} summary={trainSummary} />
          </View>
        </View>
        {network.isPending && (
          <RequestState
            loading={network.fetchStatus === 'fetching'}
            message={
              network.fetchStatus === 'paused'
                ? 'Reconnect to load the map.'
                : 'Loading the GO and UP Express network map...'
            }
          />
        )}
        {network.isError && (
          <RequestState
            message={network.error.message}
            onRetry={() => {
              void network.refetch();
            }}
          />
        )}
        {network.data && (
          <>
            {showTrains && trains.hasVisibleLines && positionsUnavailable && (
              <Text style={styles.warning}>
                Live train positions are unavailable. The station map is still available.
              </Text>
            )}
            {!visibleMapStops(network.data, filter).length && (
              <Text style={styles.warning}>
                No stations match these filters. Turn on a line or change your search.
              </Text>
            )}
            <View style={styles.map}>
              <TransitMap
                network={network.data}
                filter={filter}
                trains={trains.trains}
                reducedMotion={reducedMotion}
                onSelectTrain={(train) =>
                  navigation.navigate('ScheduleTripDetails', {
                    tripNumber: train.trip_number,
                    title: train.display,
                    lineCode: train.line_code,
                    date: train.service_date,
                    displayDate: torontoDateTime().date,
                  })
                }
                onSelectLine={selectLine}
                onSelectStop={(id) => {
                  const stop = network.data?.stops.find((item) => item.id === id);
                  if (stop)
                    navigation.navigate('Departures', { stopCode: id, stopName: stop.name });
                }}
                onTileError={() => setTileError(true)}
              />
            </View>
            <View style={styles.footer}>
              <Text style={styles.caption}>
                {visibleMapStops(network.data, filter).length} station
                {visibleMapStops(network.data, filter).length === 1 ? '' : 's'} ·{' '}
                {visibleMapLines(network.data, filter).length} line
                {visibleMapLines(network.data, filter).length === 1 ? '' : 's'}
                {showTrains &&
                  !!trains.dataUpdatedAt &&
                  `\nTrains checked ${checkedTime(trains.dataUpdatedAt)}`}
              </Text>
              {showTrains && trains.hasVisibleLines && (
                <View style={styles.refreshControl}>
                  {trains.isFetching ? (
                    <ActivityIndicator
                      accessibilityLabel="Refreshing train positions"
                      size="small"
                      color={colors.primary}
                    />
                  ) : (
                    <IconButton
                      name="refresh-cw"
                      label="Refresh train positions"
                      onPress={() => void trains.refetch()}
                    />
                  )}
                </View>
              )}
              {hiddenLineCodes.length > 0 && (
                <IconButton
                  name="rotate-ccw"
                  label="Show all lines on map"
                  onPress={() => setHiddenLineCodes([])}
                />
              )}
              <IconButton name="info" label="Map information" onPress={() => setInfo(true)} />
            </View>
            {(network.data.stale || network.fetchStatus === 'paused') && (
              <Text style={styles.warning}>Showing previously loaded network data.</Text>
            )}
            {tileError && (
              <Text style={styles.warning}>
                Street tiles could not load. Station and route overlays are still available.
              </Text>
            )}
          </>
        )}
        <SelectionModal visible={info} onClose={() => setInfo(false)}>
          <ScrollView contentContainerStyle={styles.info}>
            <View style={styles.heading}>
              <Text style={styles.title}>About this map</Text>
              <IconButton name="x" label="Close map information" onPress={() => setInfo(false)} />
            </View>
            <Text style={styles.paragraph}>
              Tap a station to view departures. Open Routes to show or hide train lines and search
              bus routes. Choose any combination, then tap Done. Tap a route to focus on it. Search
              by station name or code. White circles mark stations; zoom in to reveal more stops and
              names. Nearby trains form a pulsing group with a count. Tap a group to zoom in; trains
              sharing a location can be selected from a list at closer zoom levels. Pinch to zoom
              and drag to explore.
            </Text>
            <Text style={styles.paragraph}>
              The map shows published GO train, bus, and UP Express routes. Pulsing train icons show
              recently reported GO train positions, refreshed every five minutes while this map is
              active. Use the refresh button at the bottom to check sooner. Tap a train for its
              latest report and stops. Small arrows point approximately toward a train's reported
              next stop; they are hidden for groups, stopped trains, or unclear directions. Reports
              older than three minutes are hidden, so trains can disappear before the next automatic
              check. These are reported positions, not continuously tracked movement. UP Express and
              bus vehicle positions are not shown. Check schedules for service on your travel date.
            </Text>
            <Text style={styles.paragraph}>
              Transit data: Metrolinx. Feed coverage: {serviceDate(network.data?.valid_from ?? '')}{' '}
              to {serviceDate(network.data?.valid_until ?? '')}.
            </Text>
            <Text style={styles.paragraph}>
              Data used in this product or service is provided with the permission of Metrolinx.
              Metrolinx makes no representations or warranties of any kind, express or implied, with
              respect to the Data and assumes no responsibility for the accuracy or currency of the
              data used in this product or service.
            </Text>
            <Text style={styles.paragraph}>
              Street map © OpenStreetMap contributors. Interactive map powered by Leaflet. Street
              tiles require an internet connection.
            </Text>
          </ScrollView>
        </SelectionModal>
      </SafeAreaView>
    </Screen>
  );
}
