import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SelectionModal } from '../layout/SelectionModal';
import type { LineSummary } from '../../api/generated';
import { LineBadge } from '../ui/LineBadge';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { RequestState } from '../RequestState';
import { SearchField } from './SearchField';
import { styles } from './LinePicker.styles';

type Mode = 'All' | 'Train' | 'Bus';
const modes: Mode[] = ['All', 'Train', 'Bus'];

export function LinePicker({
  lines,
  selectedCode,
  visible,
  onClose,
  onSelect,
  availabilityLabel = 'available today',
}: {
  lines: LineSummary[];
  selectedCode?: string;
  visible: boolean;
  onClose: () => void;
  onSelect: (line: LineSummary) => void;
  availabilityLabel?: string;
}) {
  const [mode, setMode] = useState<Mode>('All');
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () =>
      lines
        .filter(
          (line) =>
            (mode === 'All' || line.vehicle_types?.includes(mode)) &&
            `${line.code} ${line.name}`.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true })),
    [lines, mode, search],
  );

  return (
    <SelectionModal visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.heading}>
            Choose a Line
          </Text>
          <IconButton name="x" label="Close line picker" onPress={onClose} />
        </View>
        <View style={styles.filters}>
          {modes.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={`${option} lines`}
              accessibilityState={{ selected: mode === option }}
              style={[styles.filter, mode === option && styles.activeFilter]}
              onPress={() => setMode(option)}
            >
              <Text style={[styles.filterText, mode === option && styles.activeFilterText]}>
                {option === 'All' ? 'All' : option === 'Train' ? 'Trains' : 'Buses'}
              </Text>
            </Pressable>
          ))}
        </View>
        <SearchField
          placeholder="Search line name or number..."
          value={search}
          onChange={setSearch}
        />
        <Text style={styles.count}>
          {filtered.length} line{filtered.length === 1 ? '' : 's'} {availabilityLabel}
        </Text>
        <FlatList
          style={styles.list}
          data={filtered}
          keyExtractor={(line) => line.code}
          keyboardShouldPersistTaps="handled"
          extraData={selectedCode}
          ListEmptyComponent={
            <RequestState
              message={
                search
                  ? 'No lines match your search.'
                  : 'No lines are listed for this service type today.'
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Select ${item.name}, line ${item.code}`}
              accessibilityState={{ selected: item.code === selectedCode }}
              style={({ pressed }) => [
                styles.row,
                item.code === selectedCode && styles.selectedRow,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                onSelect(item);
                setSearch('');
                onClose();
              }}
            >
              <LineBadge code={item.code} />
              <View style={styles.details}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.mode}>{item.vehicle_types?.join(' & ') || 'Transit line'}</Text>
              </View>
              <Icon
                name={
                  item.code === selectedCode
                    ? 'check-circle'
                    : item.vehicle_types?.includes('Train')
                      ? 'train'
                      : 'truck'
                }
                size={20}
              />
            </Pressable>
          )}
        />
      </View>
    </SelectionModal>
  );
}
