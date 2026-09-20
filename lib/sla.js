export function isWithinBusinessHours(date, hours = [], timezone = 'Africa/Lagos') {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(date));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((part) => part.type === 'weekday')?.value);
  const minutes = Number(parts.find((part) => part.type === 'hour')?.value || 0) * 60 + Number(parts.find((part) => part.type === 'minute')?.value || 0);
  return hours.some((entry) => entry.enabled !== false && entry.weekday === weekday && minutes >= toMinutes(entry.start_time) && minutes < toMinutes(entry.end_time));
}

export function slaState({ startedAt, targetMinutes, now = new Date() }) {
  const dueAt = new Date(new Date(startedAt).getTime() + Number(targetMinutes || 0) * 60000);
  const remainingMinutes = Math.ceil((dueAt.getTime() - new Date(now).getTime()) / 60000);
  return { dueAt, remainingMinutes, overdue: remainingMinutes < 0 };
}

function toMinutes(value) {
  const [hours, minutes] = String(value || '00:00').split(':').map(Number);
  return hours * 60 + minutes;
}
