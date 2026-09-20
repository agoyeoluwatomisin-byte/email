import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireSession } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requireSession(req, res))) return;

  const { direction, threadId, folder, starred, search, senderDomain, fromDate, toDate, read, before, limit = '300' } = req.query || {};

  let query = supabaseAdmin.from('emails').select('*');
  if (folder !== 'trash') query = query.is('deleted_at', null);

  if (direction) {
    query = query.eq('direction', direction);
  }

  if (threadId) {
    query = query.eq('thread_id', threadId);
  }

  if (folder) {
    query = query.eq('folder', folder);
  }

  if (starred === 'true') {
    query = query.eq('starred', true);
  }

  if (senderDomain) {
    query = query.eq('sender_domain', String(senderDomain).trim().toLowerCase());
  }

  if (fromDate) {
    query = query.gte('received_at', `${fromDate}T00:00:00.000Z`);
  }

  if (toDate) {
    const endDate = new Date(`${toDate}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    query = query.lt('received_at', endDate.toISOString());
  }

  if (read === 'true' || read === 'false') {
    query = query.eq('read', read === 'true');
  }

  if (before) {
    const beforeDate = new Date(String(before));
    if (!Number.isNaN(beforeDate.getTime())) query = query.lt('received_at', beforeDate.toISOString());
  }

  if (search) {
    const term = String(search).trim().replace(/[%(),]/g, ' ');
    if (term) {
      query = query.textSearch('search_vector', term, { type: 'websearch', config: 'simple' });
    }
  }

  const { data, error } = await query
    .order('received_at', { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 300, 1), 500));

  if (error) {
    console.error('Failed to load emails:', error);
    return res.status(500).json({ error: 'Failed to load emails' });
  }

  const messageIds = (data || []).map((email) => email.message_id).filter(Boolean);
  const { data: events } = messageIds.length
    ? await supabaseAdmin.from('email_events').select('message_id, event_type, occurred_at').in('message_id', messageIds).order('occurred_at', { ascending: false })
    : { data: [] };
  const latestEvents = new Map();
  for (const event of events || []) if (!latestEvents.has(event.message_id)) latestEvents.set(event.message_id, event);

  return res.status(200).json({
    emails: (data || []).map((email) => ({
      ...email,
      attachments: normalizeAttachments(email.attachments),
      deliveryStatus: latestEvents.get(email.message_id)?.event_type || null,
    })),
  });
}

function normalizeAttachments(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
}
