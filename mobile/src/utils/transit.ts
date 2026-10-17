export const railLines = [
  { code: 'LW', name: 'Lakeshore West', color: '#98002E' },
  { code: 'LE', name: 'Lakeshore East', color: '#FF0D00' },
  { code: 'MI', name: 'Milton', color: '#F26522' },
  { code: 'KI', name: 'Kitchener', color: '#00853E' },
  { code: 'RH', name: 'Richmond Hill', color: '#0099CC' },
  { code: 'BR', name: 'Barrie', color: '#00529B' },
  { code: 'ST', name: 'Stouffville', color: '#794500' },
  { code: 'UP', name: 'UP Express', color: '#0075D2' },
] as const;
export function lineInfo(code: string) {
  return railLines.find((line) => line.code === canonicalLineCode(code));
}
export function canonicalLineCode(code: string) {
  // Metrolinx still uses GT for the Kitchener line in its API.
  const value = code.toUpperCase();
  return value === 'GT' ? 'KI' : value === 'UPX' ? 'UP' : value;
}

export function serviceLineCode(service: string) {
  const name = service.trim().toLowerCase();
  if (name === 'union pearson express') return 'UP';
  const line = railLines.find(
    (line) => line.name.toLowerCase() === name || line.code === canonicalLineCode(service.trim()),
  );
  return line?.code ?? (/^\d+$/.test(service.trim()) ? service.trim() : undefined);
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

export function serviceDate(value: string) {
  const digits = value.replace(/-/g, '');
  if (!/^\d{8}$/.test(digits)) return value;
  const date = new Date(
    Date.UTC(Number(digits.slice(0, 4)), Number(digits.slice(4, 6)) - 1, Number(digits.slice(6))),
  );
  return date.toLocaleDateString('en-CA', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function easternTimeLabel(value: string | Date) {
  const digits = typeof value === 'string' ? value.replace(/-/g, '') : null;
  const date = digits
    ? new Date(
        Date.UTC(
          Number(digits.slice(0, 4)),
          Number(digits.slice(4, 6)) - 1,
          Number(digits.slice(6, 8)),
          12,
        ),
      )
    : new Date(
        Date.UTC(
          (value as Date).getFullYear(),
          (value as Date).getMonth(),
          (value as Date).getDate(),
          12,
        ),
      );
  return (
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', timeZoneName: 'short' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'ET'
  );
}
