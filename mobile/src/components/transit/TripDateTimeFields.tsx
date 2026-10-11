import { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { clockTime, easternTimeLabel } from '../../utils/transit';
import { Icon } from '../ui/Icon';
import { ActionButton } from '../ui/ActionButton';
import { TripDateField } from './TripDateField';
import { styles } from './transit.styles';

export function TripDateTimeFields({
  value,
  onChange,
  timeLabel = 'Choose departure time',
}: {
  value: Date;
  onChange: (date: Date) => void;
  timeLabel?: string;
}) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  return (
    <>
      <TripDateField value={value} onChange={onChange} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={timeLabel}
        style={styles.field}
        onPress={() => setShowTimePicker(true)}
      >
        <Icon name="clock" size={16} />
        <Text style={styles.fieldText}>
          {clockTime(value.getHours(), value.getMinutes())} {easternTimeLabel(value)}
        </Text>
      </Pressable>
      {showTimePicker && (
        <DateTimePicker
          value={value}
          mode="time"
          is24Hour={false}
          locale={Platform.OS === 'ios' ? 'en-US' : undefined}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_event, selected) => {
            if (Platform.OS !== 'ios') setShowTimePicker(false);
            if (selected) onChange(selected);
          }}
        />
      )}
      {showTimePicker && Platform.OS === 'ios' && (
        <ActionButton title="Done" secondary onPress={() => setShowTimePicker(false)} />
      )}
    </>
  );
}
