import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SelectionModal } from '../layout/SelectionModal';
import { useStops } from '../../hooks/transitQueries';
import type { Stop } from '../../api/generated';
import { SearchField } from './SearchField';
import { StationRow } from './StationRow';
import { IconButton } from '../ui/IconButton';
import { RequestState } from '../RequestState';
import { styles } from './transit.styles';
export function StationPicker({
  title,
  visible,
  onClose,
  onSelect,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  onSelect: (stop: Stop) => void;
}) {
  const [search, setSearch] = useState('');
  const stops = useStops();
  const filtered = useMemo(
    () =>
      (stops.data ?? [])
        .filter((stop) =>
          `${stop.name} ${stop.id}`.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [stops.data, search],
  );
  return (
    <SelectionModal visible={visible} onClose={onClose}>
      <View style={styles.modalBody}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <IconButton name="x" label="Close station picker" onPress={onClose} />
        </View>
        <SearchField value={search} onChange={setSearch} />
        {stops.isError && (
          <RequestState
            message={stops.error.message}
            onRetry={() => {
              void stops.refetch();
            }}
          />
        )}
        <FlatList
          style={styles.modalList}
          data={filtered}
          keyExtractor={(stop) => stop.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <RequestState
              loading={stops.isPending && stops.fetchStatus !== 'paused'}
              message={
                stops.fetchStatus === 'paused'
                  ? 'Reconnect to load stations.'
                  : stops.isPending
                    ? 'Loading stations...'
                    : 'No matching stations.'
              }
            />
          }
          renderItem={({ item }) => (
            <StationRow
              stop={item}
              favoriteAction={false}
              onPress={() => {
                onSelect(item);
                setSearch('');
                onClose();
              }}
            />
          )}
        />
      </View>
    </SelectionModal>
  );
}
