export const railLines = [
  { code: 'LW', name: 'Lakeshore West', color: '#A52A2A' },
  { code: 'LE', name: 'Lakeshore East', color: '#A52A2A' },
  { code: 'MI', name: 'Milton', color: '#F26522' },
  { code: 'KI', name: 'Kitchener', color: '#00853E' },
  { code: 'RH', name: 'Richmond Hill', color: '#0099CC' },
  { code: 'BR', name: 'Barrie', color: '#00529B' },
  { code: 'ST', name: 'Stouffville', color: '#794500' },
] as const;
export function lineInfo(code: string) {
  return railLines.find((line) => line.code === canonicalLineCode(code));
}
export function canonicalLineCode(code: string) {
  // Metrolinx still uses GT for the Kitchener line in its API.
  return code.toUpperCase() === 'GT' ? 'KI' : code.toUpperCase();
}
export function torontoDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${get('year')}${get('month')}${get('day')}`,
    time: `${get('hour')}${get('minute')}`,
  };
}
export function serviceTime(value?: string | null) {
  if (!value) return 'Time unavailable';
  const match = value.match(/(?:T|\s|^)(\d{2}):(\d{2})/);
  return match ? clockTime(Number(match[1]), Number(match[2])) : value;
}

export function clockTime(hours: number, minutes: number) {
  const hour = hours % 24;
  return `${hour % 12 || 12}:${String(minutes).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export function checkedTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    timeZone: 'America/Toronto',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function serviceTimestamp(value: string) {
  return value
    .replace('T', ' ')
    .replace(/(\d{2}):(\d{2})(?::\d{2})?/, (_match, hours: string, minutes: string) =>
      clockTime(Number(hours), Number(minutes)),
    );
}
export function plainText(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

export function journeyDuration(value: string) {
  const match = value.match(/^(\d+):(\d{2}):\d{2}$/);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return (
    [hours ? `${hours} hr` : '', minutes ? `${minutes} min` : ''].filter(Boolean).join(' ') ||
    '0 min'
  );
}

export function vehicleName(value: string) {
  return value === 'T' ? 'Train' : value === 'B' ? 'Bus' : value;
}
