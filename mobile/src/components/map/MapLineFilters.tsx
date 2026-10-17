import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import type { MapLine } from '../../api/generated';
import { SelectionModal } from '../layout/SelectionModal';
import { SearchField } from '../transit/SearchField';
import { MotionPressable } from '../ui/MotionPressable';
import { IconButton } from '../ui/IconButton';
import { Icon } from '../ui/Icon';
import { LineBadge } from '../ui/LineBadge';
import { colors } from '../../theme/tokens';
import { styles, chipColors, chipDotColor, chipTextColor } from './MapLineFilters.styles';

const railOrder = ['LW', 'LE', 'MI', 'KI', 'BR', 'RH', 'ST', 'UP'];

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
  const [showBuses, setShowBuses] = useState(false);
  const [search, setSearch] = useState('');
  const rails = lines
    .filter((line) => line.vehicle_type === 'Train')
    .sort((a, b) => railOrder.indexOf(a.code) - railOrder.indexOf(b.code));
  const buses = lines
    .filter((line) => line.vehicle_type === 'Bus')
    .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
  const shown = buses.filter((line) => !hiddenCodes.includes(line.code)).length;
  const close = () => {
    setShowBuses(false);
    setSearch('');
  };
  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {rails.map((line) => {
          const selected = !hiddenCodes.includes(line.code);
          return (
            <MotionPressable
              key={line.code}
              accessibilityRole="checkbox"
              accessibilityLabel={`${line.name} line ${line.code}`}
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              style={[styles.chip, chipColors(line.color, selected)]}
              onPress={() => onToggle(line.code)}
            >
              <View style={[styles.dot, chipDotColor(line.color, selected)]} />
              <Text style={[styles.code, chipTextColor(selected)]}>{line.code}</Text>
            </MotionPressable>
          );
        })}
      </View>
      <View style={styles.actions}>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Choose bus routes on map"
          style={styles.busButton}
          onPress={() => setShowBuses(true)}
        >
          <Icon name="truck" size={16} />
          <Text style={styles.busLabel}>
            Bus routes ({shown}/{buses.length})
          </Text>
          <Icon name="chevron-down" size={16} />
        </MotionPressable>
      </View>
      <SelectionModal visible={showBuses} onClose={close}>
        <View style={styles.modal}>
          <View style={styles.heading}>
            <Text style={styles.title}>Bus Routes</Text>
            <IconButton name="x" label="Close bus route filters" onPress={close} />
          </View>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search bus route name or number..."
          />
          <View style={styles.bulk}>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="Show all bus routes"
              style={styles.bulkButton}
              onPress={() =>
                onSetVisible(
                  buses.map((line) => line.code),
                  true,
                )
              }
            >
              <Text style={styles.bulkLabel}>Show all</Text>
            </MotionPressable>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="Hide all bus routes"
              style={styles.bulkButton}
              onPress={() =>
                onSetVisible(
                  buses.map((line) => line.code),
                  false,
                )
              }
            >
              <Text style={styles.bulkLabel}>Hide all</Text>
            </MotionPressable>
          </View>
          <FlatList
            style={styles.list}
            data={buses.filter((line) =>
              `${line.code} ${line.name}`.toLowerCase().includes(search.trim().toLowerCase()),
            )}
            keyExtractor={(line) => line.code}
            extraData={hiddenCodes}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.routeName}>No matching bus routes.</Text>}
            renderItem={({ item: line }) => (
              <MotionPressable
                accessibilityRole="checkbox"
                accessibilityLabel={`${line.name} bus route ${line.code}`}
                accessibilityState={{ checked: !hiddenCodes.includes(line.code) }}
                aria-checked={!hiddenCodes.includes(line.code)}
                style={styles.row}
                onPress={() => onToggle(line.code)}
              >
                <LineBadge code={line.code} />
                <Text style={styles.routeName}>{line.name}</Text>
                <Icon
                  name={hiddenCodes.includes(line.code) ? 'square' : 'check-square'}
                  color={hiddenCodes.includes(line.code) ? colors.muted : colors.primary}
                />
              </MotionPressable>
            )}
          />
        </View>
      </SelectionModal>
    </View>
  );
}
