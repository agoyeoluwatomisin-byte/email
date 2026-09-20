import { describe, expect, it } from 'vitest';
import { colorFromString, formatBytes, formatRelativeTime, groupByDate, initialsFromAddress } from './mailbox';

describe('mailbox utilities', () => {
  const now = new Date('2026-09-20T12:00:00Z');

  it('formats relative times and bytes', () => {
    expect(formatRelativeTime('2026-09-20T10:00:00Z', now)).toBe('2h');
    expect(formatRelativeTime('2026-09-19T10:00:00Z', now)).toBe('Yesterday');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('groups messages by calendar period', () => {
    const groups = groupByDate(
      [
        { received_at: '2026-09-20T09:00:00Z' },
        { received_at: '2026-09-19T09:00:00Z' },
        { received_at: '2026-09-15T09:00:00Z' },
        { received_at: '2026-08-01T09:00:00Z' },
      ],
      (item) => item.received_at,
      now,
    );
    expect(groups.Today).toHaveLength(1);
    expect(groups.Yesterday).toHaveLength(1);
    expect(groups['This week']).toHaveLength(1);
    expect(groups.Earlier).toHaveLength(1);
  });

  it('creates stable identities and colors', () => {
    expect(initialsFromAddress('Ada Lovelace <ada@example.com>')).toBe('AL');
    expect(colorFromString('ada@example.com')).toBe(colorFromString('ada@example.com'));
  });
});
