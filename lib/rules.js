export function matchesRule(message, conditions = {}) {
  const from = String(message.from || '').toLowerCase();
  const subject = String(message.subject || '').toLowerCase();
  const to = String(message.to || '').toLowerCase();
  const domain = from.split('@')[1] || '';
  if (conditions.from && !from.includes(String(conditions.from).toLowerCase())) return false;
  if (conditions.to && !to.includes(String(conditions.to).toLowerCase())) return false;
  if (conditions.subject_contains && !subject.includes(String(conditions.subject_contains).toLowerCase())) return false;
  if (conditions.sender_domain && domain !== String(conditions.sender_domain).toLowerCase()) return false;
  if (conditions.has_attachment !== undefined && Boolean(conditions.has_attachment) !== Boolean(message.hasAttachment)) return false;
  return true;
}

export function firstMatchingRule(message, rules = []) {
  return rules.filter((rule) => rule.enabled !== false).sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).find((rule) => matchesRule(message, rule.conditions));
}
