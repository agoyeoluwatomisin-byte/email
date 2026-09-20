import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  const from = parseDate(req.query?.from, Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = parseDate(req.query?.to, Date.now());
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return res.status(400).json({ error: 'Invalid date range.' });
  let { data: emails, error } = await supabaseAdmin.from('emails').select('direction, label, received_at, from_address, thread_id, first_response_at, resolved_at').gte('received_at', from.toISOString()).lte('received_at', to.toISOString()).limit(10000);
  if (error && isMissingAnalyticsColumn(error)) {
    const fallback = await supabaseAdmin.from('emails').select('direction, label, received_at, from_address, thread_id').gte('received_at', from.toISOString()).lte('received_at', to.toISOString()).limit(10000);
    emails = fallback.data;
    error = fallback.error;
  }
  if (error) return res.status(500).json({ error: 'Failed to load analytics.' });
  const { data: csat } = await supabaseAdmin.from('csat_responses').select('rating').gte('created_at', from.toISOString()).lte('created_at', to.toISOString());
  const volume = {};
  const labels = {};
  const agents = {};
  const resolutionTimes = [];
  const firstResponseTimes = [];
  for (const email of emails || []) {
    const day = String(email.received_at).slice(0, 10);
    volume[day] = (volume[day] || 0) + 1;
    labels[email.label || 'other'] = (labels[email.label || 'other'] || 0) + 1;
    if (email.direction === 'outbound') {
      const agent = email.from_address || 'unknown';
      agents[agent] = (agents[agent] || 0) + 1;
    }
    if (email.first_response_at) firstResponseTimes.push((new Date(email.first_response_at) - new Date(email.received_at)) / 60000);
    if (email.resolved_at) resolutionTimes.push((new Date(email.resolved_at) - new Date(email.received_at)) / 60000);
  }
  const { data: resolvedThreads } = await supabaseAdmin.from('threads').select('thread_id, status, claimed_by, updated_at').eq('status', 'closed').gte('updated_at', from.toISOString()).lte('updated_at', to.toISOString());
  return res.status(200).json({
    volume,
    labels,
    agents: Object.entries(agents).map(([email, replies]) => ({ email, replies, resolved: (resolvedThreads || []).filter((thread) => thread.claimed_by === email).length })),
    csatAverage: csat?.length ? csat.reduce((sum, item) => sum + item.rating, 0) / csat.length : null,
    averageFirstResponseMinutes: average(firstResponseTimes),
    medianResolutionMinutes: median(resolutionTimes),
    overdueCount: (emails || []).filter((email) => !email.first_response_at && email.direction === 'inbound' && Date.now() - new Date(email.received_at).getTime() > 4 * 60 * 60 * 1000).length,
    total: emails?.length || 0,
  });
}

function average(values) { return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null; }
function parseDate(value, fallback) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const date = candidate ? new Date(String(candidate)) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}
function isMissingAnalyticsColumn(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42703' || message.includes('first_response_at') || message.includes('resolved_at');
}
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}
