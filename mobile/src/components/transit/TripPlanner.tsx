import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../../navigation/types';
import type { Stop } from '../../api/generated';
import { usePreferences } from '../../storage/PreferencesProvider';
import { torontoDateTime, clockTime } from '../../utils/transit';
import { Card } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { ActionButton } from '../ui/ActionButton';
import { StationPicker } from './StationPicker';
import { TripDateField } from './TripDateField';
import { styles } from './transit.styles';
type SelectedStop = Pick<Stop, 'id' | 'name' | 'type'>;
function initialDate() {
  const now = torontoDateTime();
  return new Date(
    Number(now.date.slice(0, 4)),
    Number(now.date.slice(4, 6)) - 1,
    Number(now.date.slice(6, 8)),
    Number(now.time.slice(0, 2)),
    Number(now.time.slice(2)),
  );
}
export function TripPlanner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { home, work, ready } = usePreferences();
  const [from, setFrom] = useState<SelectedStop | null>(null);
  const [to, setTo] = useState<SelectedStop | null>(null);
  const [date, setDate] = useState(initialDate);
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const pad = (value: number) => String(value).padStart(2, '0');
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
      date: `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
      time: `${pad(date.getHours())}${pad(date.getMinutes())}`,
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
        <Pressable
          style={styles.editCommute}
          accessibilityRole="button"
          onPress={() => navigation.navigate('Preferences')}
        >
          <Text style={styles.link}>＋ Edit home & work stations</Text>
        </Pressable>
        <View style={styles.fields}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose origin station"
            style={styles.field}
            onPress={() => setPicker('from')}
          >
            <View style={styles.originDot} />
            <Text style={[styles.fieldText, !from && styles.placeholder]}>
              {from?.name ?? 'From station'}
            </Text>
            <Icon name="chevron-down" size={16} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose destination station"
            style={styles.field}
            onPress={() => setPicker('to')}
          >
            <View style={styles.destinationDot} />
            <Text style={[styles.fieldText, !to && styles.placeholder]}>
              {to?.name ?? 'To station'}
            </Text>
            <Icon name="chevron-down" size={16} />
          </Pressable>
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
        <TripDateField value={date} onChange={setDate} />
        <Pressable
          accessibilityRole="button"
          style={styles.field}
          onPress={() => setShowTimePicker(true)}
        >
          <Icon name="clock" size={16} />
          <Text style={styles.fieldText}>
            {clockTime(date.getHours(), date.getMinutes())} · Toronto time
          </Text>
        </Pressable>
        {showTimePicker && (
          <DateTimePicker
            value={date}
            mode="time"
            is24Hour={false}
            locale={Platform.OS === 'ios' ? 'en-US' : undefined}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_event, selected) => {
              if (Platform.OS !== 'ios') setShowTimePicker(false);
              if (selected) setDate(selected);
            }}
          />
        )}
        {showTimePicker && Platform.OS === 'ios' && (
          <ActionButton title="Done" secondary onPress={() => setShowTimePicker(false)} />
        )}
        {from && to && from.id === to.id && (
          <Text style={styles.note}>Choose two different stations.</Text>
        )}
        <ActionButton
          title="Search Trips"
          icon="search"
          disabled={!from || !to || from.id === to.id}
          onPress={search}
        />
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
