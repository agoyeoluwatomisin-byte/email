import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireSession } from '../../../lib/auth';

export default async function handler(req, res) {
  if (!['DELETE', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', ['DELETE', 'PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requireSession(req, res))) return;

  const { id } = req.query || {};
  if (!id) {
    return res.status(400).json({ error: 'Email thread id is required' });
  }

  if (req.method === 'PATCH') {
    const { read, starred, folder } = req.body || {};
    const updates = {};

    if (typeof read === 'boolean') updates.read = read;
    if (typeof starred === 'boolean') updates.starred = starred;
    if (typeof folder === 'string' && ['inbox', 'archive', 'spam', 'drafts', 'sent'].includes(folder)) {
      updates.folder = folder;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Provide a valid read, starred, or folder update' });
    }

    const { error } = await supabaseAdmin.from('emails').update(updates).eq('thread_id', id);

    if (error) {
      console.error('Failed to update email thread:', error);
      return res.status(500).json({ error: 'Failed to update email thread' });
    }

    return res.status(200).json({ success: true, threadId: id, updates });
  }

  const { error } = await supabaseAdmin
    .from('emails')
    .update({ folder: 'trash', deleted_at: new Date().toISOString() })
    .eq('thread_id', id);

  if (error) {
    console.error('Failed to delete email thread:', error);
    return res.status(500).json({ error: 'Failed to delete email thread' });
  }

  return res.status(200).json({ success: true, threadId: id });
}
