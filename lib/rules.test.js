import { describe, expect, it } from 'vitest';
import { firstMatchingRule, matchesRule } from './rules';
import { isWithinBusinessHours, slaState } from './sla';

describe('automation helpers', () => {
  it('matches sender and attachment conditions', () => {
    expect(
      matchesRule(
        { from: 'a@example.com', hasAttachment: true },
        { sender_domain: 'example.com', has_attachment: true },
      ),
    ).toBe(true);
    expect(matchesRule({ from: 'a@example.com', hasAttachment: false }, { has_attachment: true })).toBe(false);
  });
  it('selects enabled rules by order', () => {
    expect(
      firstMatchingRule({ subject: 'urgent request' }, [
        { order_index: 2, conditions: { subject_contains: 'urgent' } },
        { order_index: 1, conditions: { subject_contains: 'urgent' } },
      ]).order_index,
    ).toBe(1);
  });
  it('calculates SLA state', () => {
    expect(
      slaState({ startedAt: '2026-01-01T00:00:00Z', targetMinutes: 60, now: '2026-01-01T02:00:00Z' }).overdue,
    ).toBe(true);
  });
  it('respects configured business hours', () => {
    expect(
      isWithinBusinessHours('2026-01-05T10:00:00Z', [{ weekday: 1, start_time: '09:00', end_time: '18:00' }], 'UTC'),
    ).toBe(true);
  });
});
