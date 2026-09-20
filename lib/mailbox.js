export function formatRelativeTime(value, now = new Date()) {
  const date = new Date(value);
  const current = new Date(now);
  const difference = Math.max(0, current.getTime() - date.getTime());
  const minutes = Math.floor(difference / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24 && date.toDateString() === current.toDateString()) return `${hours}h`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function groupByDate(items, getDate = (item) => item.received_at, now = new Date()) {
  const current = new Date(now);
  const startOfToday = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - ((startOfToday.getDay() + 6) % 7));
  const groups = { Today: [], Yesterday: [], 'This week': [], Earlier: [] };

  for (const item of items) {
    const date = new Date(getDate(item));
    if (date >= startOfToday) groups.Today.push(item);
    else if (date >= startOfYesterday) groups.Yesterday.push(item);
    else if (date >= startOfWeek) groups['This week'].push(item);
    else groups.Earlier.push(item);
  }

  return groups;
}

export function initialsFromAddress(value) {
  const address = String(value || '').trim();
  const name = address.match(/^([^<]+)</)?.[1]?.trim() || address.split('@')[0] || '?';
  const words = name.split(/[\s._-]+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : name.slice(0, 2)).toUpperCase();
}

export function colorFromString(value) {
  let hash = 0;
  for (const character of String(value || '')) hash = ((hash << 5) - hash) + character.charCodeAt(0) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 68% 48%)`;
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}
