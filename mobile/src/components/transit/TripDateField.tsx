import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { torontoDateTime } from '../../utils/transit';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { styles } from './TripDateField.styles';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function todayInToronto() {
  const { date } = torontoDateTime();
  return new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(4, 6)) - 1,
    Number(date.slice(6)),
    12,
  );
}

export function TripDateField({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1, 12));
  const today = todayInToronto();
  const startOffset = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((startOffset + daysInMonth) / 7) * 7 },
    (_, index) => {
      const day = index - startOffset + 1;
      return day > 0 && day <= daysInMonth
        ? new Date(month.getFullYear(), month.getMonth(), day, 12)
        : null;
    },
  );

  const selectDate = (selected: Date) => {
    // The calendar changes only the day; keep the chosen departure time.
    const next = new Date(value);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    onChange(next);
    setExpanded(false);
  };

  const toggleCalendar = () => {
    if (!expanded) setMonth(new Date(value.getFullYear(), value.getMonth(), 1, 12));
    setExpanded(!expanded);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose travel date"
          accessibilityState={{ expanded }}
          style={styles.field}
          onPress={toggleCalendar}
        >
          <Icon name="calendar" size={16} />
          <Text style={styles.label}>
            {sameDay(value, today)
              ? 'Today'
              : value.toLocaleDateString('en-CA', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
          </Text>
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select today"
          style={styles.todayButton}
          onPress={() => selectDate(today)}
        >
          <Text style={styles.todayLabel}>Today</Text>
        </Pressable>
      </View>
      {expanded && (
        <View style={styles.calendar}>
          <View style={styles.monthRow}>
            <IconButton
              name="chevron-left"
              label="Previous month"
              onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))}
            />
            <Text accessibilityRole="header" style={styles.month}>
              {month.toLocaleDateString('en-CA', { month: 'long' })}
            </Text>
            <IconButton
              name="chevron-right"
              label="Next month"
              onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))}
            />
          </View>
          <View style={styles.grid}>
            {weekdays.map((day) => (
              <Text key={day} style={styles.weekday}>
                {day}
              </Text>
            ))}
            {cells.map((day, index) =>
              day ? (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel={day.toLocaleDateString('en-CA', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  accessibilityState={{ selected: sameDay(day, value) }}
                  style={styles.day}
                  onPress={() => selectDate(day)}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      sameDay(day, today) && styles.currentDay,
                      sameDay(day, value) && styles.selectedDay,
                    ]}
                  >
                    <Text style={[styles.dayLabel, sameDay(day, value) && styles.selectedLabel]}>
                      {day.getDate()}
                    </Text>
                  </View>
                </Pressable>
              ) : (
                <View key={index} style={styles.day} />
              ),
            )}
          </View>
        </View>
      )}
    </View>
  );
}
