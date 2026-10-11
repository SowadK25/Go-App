export function calendarDay(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isPastDate(date: Date, today: Date) {
  return calendarDay(date) < calendarDay(today);
}

export function canGoToPreviousMonth(month: Date, today: Date) {
  return (
    month.getFullYear() > today.getFullYear() ||
    (month.getFullYear() === today.getFullYear() && month.getMonth() > today.getMonth())
  );
}
