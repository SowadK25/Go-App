import { useMemo, useState } from 'react';
import { ScrollView, SectionList, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import { transitApi } from '../api/transit';
import { useStops, useLines } from '../hooks/transitQueries';
import { usePreferences } from '../storage/PreferencesProvider';
import { Screen } from '../components/layout/Screen';
import { SearchField } from '../components/transit/SearchField';
import { StationRow } from '../components/transit/StationRow';
import { ChoiceChip } from '../components/transit/ChoiceChip';
import { Icon } from '../components/ui/Icon';
import { ActionButton } from '../components/ui/ActionButton';
import { RequestState } from '../components/RequestState';
import { lineInfo } from '../utils/transit';
import { styles } from './screens.styles';
import { styles as transitStyles } from '../components/transit/transit.styles';
export function StationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [search, setSearch] = useState('');
  const [lineCode, setLineCode] = useState<string | null>(null);
  const stops = useStops();
  const lines = useLines();
  const { favorites, storageError } = usePreferences();
  const selectedLine = lines.data?.lines?.find((line) => line.code === lineCode);
  const directions = selectedLine?.directions ?? [];
  const lineStops = useQuery({
    queryKey: ['lineStops', lineCode, directions],
    enabled: !!lineCode && directions.length > 0,
    queryFn: async ({ signal }) => {
      const responses = await Promise.all(
        directions.map((direction) => transitApi.lineStops(lineCode!, direction, signal)),
      );
      return [
        ...new Set(responses.flatMap((response) => response.stops?.map((stop) => stop.code) ?? [])),
      ];
    },
    staleTime: 86400000,
  });
  const filtered = useMemo(
    () =>
      (stops.data ?? [])
        .filter(
          (stop) =>
            `${stop.name} ${stop.id}`.toLowerCase().includes(search.trim().toLowerCase()) &&
            (!lineCode || lineStops.data?.includes(stop.id)),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [stops.data, search, lineCode, lineStops.data],
  );
  const savedIds = new Set(favorites.map((stop) => stop.id));
  const saved = filtered.filter((stop) => savedIds.has(stop.id));
  const all = filtered.filter((stop) => !savedIds.has(stop.id));
  const sections = [
    ...(saved.length ? [{ title: 'Favorites', data: saved }] : []),
    { title: 'All Stations', data: all },
  ];
  const filtering = !!lineCode && lineStops.isPending && directions.length > 0;
  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <ActionButton
          title="System Map"
          icon="map"
          secondary
          onPress={() => navigation.navigate('SystemMap')}
        />
        <SearchField value={search} onChange={setSearch} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={transitStyles.chips}
        >
          <ChoiceChip label="All Lines" selected={!lineCode} onPress={() => setLineCode(null)} />
          {lines.data?.lines
            ?.filter((line) => lineInfo(line.code))
            .map((line) => (
              <ChoiceChip
                key={line.code}
                lineCode={line.code}
                label={line.name}
                selected={lineCode === line.code}
                onPress={() => setLineCode(line.code)}
              />
            ))}
        </ScrollView>
        {storageError && <Text style={styles.subtitle}>{storageError}</Text>}
      </View>
      {(stops.isError || lineStops.isError || lines.isError) && (
        <RequestState
          message={
            stops.error?.message ??
            lineStops.error?.message ??
            lines.error?.message ??
            'Unable to load stations.'
          }
          onRetry={() => {
            void stops.refetch();
            void lines.refetch();
            if (lineCode) void lineStops.refetch();
          }}
        />
      )}
      {(stops.isPending || filtering) && (
        <RequestState
          loading={stops.fetchStatus === 'fetching' || lineStops.fetchStatus === 'fetching'}
          message={
            stops.fetchStatus === 'paused' || lineStops.fetchStatus === 'paused'
              ? 'Reconnect to load stations.'
              : 'Loading stations...'
          }
        />
      )}
      <SectionList
        sections={sections}
        keyExtractor={(stop) => stop.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshing={stops.isRefetching}
        onRefresh={() => {
          void stops.refetch();
          if (lineCode && directions.length) void lineStops.refetch();
        }}
        renderSectionHeader={({ section }) => (
          <View style={styles.favoriteHeader}>
            {section.title === 'Favorites' && <Icon name="star" size={16} />}
            <Text style={styles.sectionText}>{section.title}</Text>
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.title === 'Favorites' ? (
            <View style={styles.sectionSpacer} />
          ) : !section.data.length && !stops.isPending && !filtering ? (
            <RequestState
              message={
                lineCode && !directions.length
                  ? 'No schedule is listed for this line today.'
                  : 'No matching stations.'
              }
            />
          ) : null
        }
        renderItem={({ item }) => (
          <StationRow
            stop={item}
            lineCode={lineCode ?? undefined}
            onPress={() =>
              navigation.navigate('Departures', { stopCode: item.id, stopName: item.name })
            }
          />
        )}
      />
    </Screen>
  );
}
