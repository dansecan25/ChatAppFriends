const UNITS = ['B', 'KB', 'MB', 'GB'];

/** Formats a byte count for display, such as "1.2 GB". */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 || value >= 100 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`;
}

/** Formats a message time as "14:05", or with the date when it is not from today. */
export function formatMessageTime(date: Date): string {
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} ${time}`;
}
