import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { direction, threadId, folder, starred, limit = '300' } = req.query || {};

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
