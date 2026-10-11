import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import { transitApi } from '../api/transit';
import { Screen } from '../components/layout/Screen';
import { SelectionModal } from '../components/layout/SelectionModal';
import { MapLineFilters } from '../components/map/MapLineFilters';
import { TransitMap } from '../components/map/TransitMap';
import type { MapFilter } from '../components/map/mapTypes';
import { SearchField } from '../components/transit/SearchField';
import { IconButton } from '../components/ui/IconButton';
import { RequestState } from '../components/RequestState';
import { visibleMapLines, visibleMapStops, toggleMapLine } from '../utils/networkMap';
import { serviceDate } from '../utils/transit';
import { styles } from './SystemMapScreen.styles';

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
  const filter = useMemo<MapFilter>(
    () => ({ mode: 'all', hiddenLineCodes, search }),
    [hiddenLineCodes, search],
  );
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
        {network.isPending && (
          <RequestState
            loading={network.fetchStatus === 'fetching'}
            message={
              network.fetchStatus === 'paused'
                ? 'Reconnect to load the map.'
                : 'Loading the GO network map...'
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
            {!visibleMapStops(network.data, filter).length && (
              <Text style={styles.warning}>
                No stations match these filters. Turn on a line or change your search.
              </Text>
            )}
            <View style={styles.map}>
              <TransitMap
                network={network.data}
                filter={filter}
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
              </Text>
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
              Tap a station to view departures. Toggle the coloured line chips to show or hide
              lines. Choose any combination of bus routes. Tap a route to focus on it. Search by
              station name or code. Pinch to zoom and drag to explore.
            </Text>
            <Text style={styles.paragraph}>
              The map shows published GO train and bus routes. It is a network overview, not a live
              vehicle map; check schedules for service on your travel date.
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
