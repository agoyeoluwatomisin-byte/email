import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { direction, threadId, folder, starred, search, senderDomain, fromDate, toDate, read, limit = '300' } = req.query || {};

  let query = supabaseAdmin.from('emails').select('*');

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

  if (search) {
    const term = String(search).trim().replace(/[%(),]/g, ' ');
    if (term) {
      query = query.or(`from_address.ilike.%${term}%,subject.ilike.%${term}%,text_body.ilike.%${term}%`);
    }
  }

  const { data, error } = await query
    .order('received_at', { ascending: false })
    .limit(Number(limit) || 300);

  if (error) {
    console.error('Failed to load emails:', error);
    return res.status(500).json({ error: 'Failed to load emails' });
  }

  return res.status(200).json({
    emails: (data || []).map((email) => ({
      ...email,
      attachments: normalizeAttachments(email.attachments),
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
