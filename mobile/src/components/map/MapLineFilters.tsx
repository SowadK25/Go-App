import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import type { MapLine } from '../../api/generated';
import { BottomSheet } from '../layout/BottomSheet';
import { SearchField } from '../transit/SearchField';
import { MotionPressable } from '../ui/MotionPressable';
import { ActionButton } from '../ui/ActionButton';
import { IconButton } from '../ui/IconButton';
import { Icon } from '../ui/Icon';
import { LineBadge } from '../ui/LineBadge';
import { colors } from '../../theme/tokens';
import { styles } from './MapLineFilters.styles';

const railOrder = ['LW', 'LE', 'MI', 'KI', 'BR', 'RH', 'ST', 'UP'];

function RouteRow({
  line,
  selected,
  onPress,
  compact = false,
}: {
  line: MapLine;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <MotionPressable
      accessibilityRole="checkbox"
      accessibilityLabel={`${line.name} ${line.vehicle_type === 'Train' ? 'line' : 'bus route'} ${line.code}`}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      style={[styles.row, compact && styles.trainRow, selected && styles.selectedRow]}
      onPress={onPress}
    >
      <LineBadge code={line.code} />
      <Text style={styles.routeName}>{line.name}</Text>
      <Icon
        name={selected ? 'check-square' : 'square'}
        color={selected ? colors.primary : colors.muted}
      />
    </MotionPressable>
  );
}

function RouteSectionHeading({
  title,
  count,
  total,
  onSetVisible,
}: {
  title: string;
  count: number;
  total: number;
  onSetVisible: (visible: boolean) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.count}>
          {count} of {total} shown
        </Text>
      </View>
      <View style={styles.bulk}>
        {([true, false] as const).map((visible) => (
          <MotionPressable
            key={String(visible)}
            accessibilityRole="button"
            accessibilityLabel={`${visible ? 'Show' : 'Hide'} all ${title.toLowerCase()}`}
            style={styles.bulkButton}
            onPress={() => onSetVisible(visible)}
          >
            <Text style={styles.bulkLabel}>{visible ? 'Show all' : 'Hide all'}</Text>
          </MotionPressable>
        ))}
      </View>
    </View>
  );
}

export function MapLineFilters({
  lines,
  hiddenCodes,
  onToggle,
  onSetVisible,
}: {
  lines: MapLine[];
  hiddenCodes: string[];
  onToggle: (code: string) => void;
  onSetVisible: (codes: string[], visible: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rails = lines
    .filter((line) => line.vehicle_type === 'Train')
    .sort((a, b) => railOrder.indexOf(a.code) - railOrder.indexOf(b.code));
  const buses = lines
    .filter((line) => line.vehicle_type === 'Bus')
    .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
  const trainCount = rails.filter((line) => !hiddenCodes.includes(line.code)).length;
  const busCount = buses.filter((line) => !hiddenCodes.includes(line.code)).length;
  const summary =
    [
      trainCount ? `${trainCount} train ${trainCount === 1 ? 'line' : 'lines'}` : '',
      busCount ? `${busCount} bus ${busCount === 1 ? 'route' : 'routes'}` : '',
    ]
      .filter(Boolean)
      .join(' | ') || 'No routes shown';
  const close = () => {
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={`Routes. ${summary}. Choose routes on the map`}
        accessibilityState={{ expanded: open }}
        style={styles.trigger}
        onPress={() => setOpen(true)}
      >
        <Icon name="sliders" size={18} />
        <View style={styles.triggerText}>
          <Text style={styles.triggerTitle}>Routes</Text>
          <Text style={styles.summary}>{summary}</Text>
        </View>
        <Icon name="chevron-down" size={18} />
      </MotionPressable>
      <BottomSheet visible={open} onClose={close}>
        <View style={styles.modal}>
          <View style={styles.heading}>
            <View>
              <Text style={styles.title}>Routes</Text>
              <Text style={styles.hint}>Choose what appears on your map.</Text>
            </View>
            <IconButton name="x" label="Close route filters" onPress={close} />
          </View>
          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={buses.filter((line) =>
              `${line.code} ${line.name}`.toLowerCase().includes(search.trim().toLowerCase()),
            )}
            keyExtractor={(line) => line.code}
            extraData={hiddenCodes}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <RouteSectionHeading
                  title="Train lines"
                  count={trainCount}
                  total={rails.length}
                  onSetVisible={(visible) =>
                    onSetVisible(
                      rails.map((line) => line.code),
                      visible,
                    )
                  }
                />
                <View style={styles.railRows}>
                  {rails.map((line) => (
                    <RouteRow
                      key={line.code}
                      line={line}
                      compact
                      selected={!hiddenCodes.includes(line.code)}
                      onPress={() => onToggle(line.code)}
                    />
                  ))}
                </View>
                <RouteSectionHeading
                  title="Bus routes"
                  count={busCount}
                  total={buses.length}
                  onSetVisible={(visible) =>
                    onSetVisible(
                      buses.map((line) => line.code),
                      visible,
                    )
                  }
                />
                <SearchField
                  value={search}
                  onChange={setSearch}
                  placeholder="Search bus route name or number..."
                />
              </View>
            }
            ListEmptyComponent={<Text style={styles.hint}>No matching bus routes.</Text>}
            renderItem={({ item: line }) => (
              <RouteRow
                line={line}
                selected={!hiddenCodes.includes(line.code)}
                onPress={() => onToggle(line.code)}
              />
            )}
          />
          <ActionButton title="Done" onPress={close} />
        </View>
      </BottomSheet>
    </>
  );
}
