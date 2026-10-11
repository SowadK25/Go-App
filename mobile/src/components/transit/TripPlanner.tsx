import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../../navigation/types';
import type { Stop } from '../../api/generated';
import { usePreferences } from '../../storage/PreferencesProvider';
import { initialSearchDate, searchDateTime } from '../../utils/tripSearch';
import { Card } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { ActionButton } from '../ui/ActionButton';
import { StationPicker } from './StationPicker';
import { StationField } from './StationField';
import { TripDateTimeFields } from './TripDateTimeFields';
import { SegmentedTabs } from '../ui/SegmentedTabs';
import type { JourneySearchMode } from '../../utils/journeys';
import { styles } from './transit.styles';
type SelectedStop = Pick<Stop, 'id' | 'name' | 'type'>;
export function TripPlanner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { home, work, ready, storageError } = usePreferences();
  const [from, setFrom] = useState<SelectedStop | null>(null);
  const [to, setTo] = useState<SelectedStop | null>(null);
  const [date, setDate] = useState(initialSearchDate);
  const [searchMode, setSearchMode] = useState<JourneySearchMode>('depart_at');
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const selectCommute = (reverse = false) => {
    if (!home || !work) {
      navigation.navigate('Preferences');
      return;
    }
    setFrom(reverse ? work : home);
    setTo(reverse ? home : work);
  };
  const search = () => {
    if (!from || !to || from.id === to.id) return;
    navigation.navigate('TripResults', {
      fromCode: from.id,
      fromName: from.name,
      toCode: to.id,
      toName: to.name,
      ...searchDateTime(date),
      searchMode,
    });
  };
  return (
    <Card>
      <View style={styles.planner}>
        <SectionHeading title="Plan Your Trip" />
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Plan home to work"
            style={styles.commute}
            disabled={!ready}
            onPress={() => selectCommute()}
          >
            <View style={styles.commuteIcon}>
              <Icon name="home" size={16} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.commuteLabel}>Home → Work</Text>
              <Text numberOfLines={1} style={styles.commuteStation}>
                {work?.name ?? 'Set your stations'}
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Plan work to home"
            style={styles.commute}
            disabled={!ready}
            onPress={() => selectCommute(true)}
          >
            <View style={styles.commuteIcon}>
              <Icon name="briefcase" size={16} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.commuteLabel}>Work → Home</Text>
              <Text numberOfLines={1} style={styles.commuteStation}>
                {home?.name ?? 'Set your stations'}
              </Text>
            </View>
          </Pressable>
        </View>
        <View style={styles.fields}>
          <View style={styles.stationFields}>
            <StationField
              kind="origin"
              name={from?.name}
              onSelect={() => setPicker('from')}
              onClear={() => setFrom(null)}
            />
            <StationField
              kind="destination"
              name={to?.name}
              onSelect={() => setPicker('to')}
              onClear={() => setTo(null)}
            />
          </View>
          <View style={styles.swap}>
            <IconButton
              name="repeat"
              label="Swap origin and destination"
              onPress={() => {
                setFrom(to);
                setTo(from);
              }}
            />
          </View>
        </View>
        <SegmentedTabs
          options={[
            { value: 'depart_at', label: 'Depart at' },
            { value: 'arrive_by', label: 'Arrive by' },
          ]}
          value={searchMode}
          onChange={setSearchMode}
        />
        <TripDateTimeFields
          value={date}
          onChange={setDate}
          timeLabel={searchMode === 'arrive_by' ? 'Choose arrival time' : 'Choose departure time'}
        />
        {from && to && from.id === to.id && (
          <Text style={styles.note}>Choose two different stations.</Text>
        )}
        <ActionButton
          title="Search Trips"
          icon="search"
          disabled={!from || !to || from.id === to.id}
          onPress={search}
        />
        {!!storageError && <Text style={styles.note}>{storageError}</Text>}
      </View>
      <StationPicker
        visible={picker !== null}
        title={picker === 'from' ? 'From station' : 'To station'}
        onClose={() => setPicker(null)}
        onSelect={(stop) => (picker === 'from' ? setFrom(stop) : setTo(stop))}
      />
    </Card>
  );
}
