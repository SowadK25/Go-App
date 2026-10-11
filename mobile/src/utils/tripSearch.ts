import { torontoDateTime } from './transit';

// Native pickers use local Date fields; initialize those fields with Toronto time.
export function initialSearchDate(current = new Date()) {
  const now = torontoDateTime(current);
  return new Date(
    +now.date.slice(0, 4),
    +now.date.slice(4, 6) - 1,
    +now.date.slice(6, 8),
    +now.time.slice(0, 2),
    +now.time.slice(2),
  );
}

export function searchDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
    time: `${pad(date.getHours())}${pad(date.getMinutes())}`,
  };
}
