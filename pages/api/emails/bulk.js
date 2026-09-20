import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireSession } from '../../../lib/auth';

const folders = ['inbox', 'archive', 'spam', 'drafts', 'sent'];

export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', ['PATCH', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requireSession(req, res))) return;

  const { threadIds, action } = req.body || {};
  if (!Array.isArray(threadIds) || threadIds.length === 0) {
    return res.status(400).json({ error: 'threadIds must be a non-empty array' });
  }

  if (req.method === 'DELETE' || action === 'delete') {
    const { error } = await supabaseAdmin
      .from('emails')
      .update({ folder: 'trash', deleted_at: new Date().toISOString() })
      .in('thread_id', threadIds);
    if (error) {
      console.error('Failed to delete email threads:', error);
      return res.status(500).json({ error: 'Failed to delete email threads' });
    }
    return res.status(200).json({ success: true, threadIds });
  }

  const updates = {};
  if (action === 'read') updates.read = true;
  if (action === 'unread') updates.read = false;
  if (action === 'star') updates.starred = true;
  if (action === 'unstar') updates.starred = false;
  if (folders.includes(action)) updates.folder = action;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Unsupported bulk action' });
  }

  const { error } = await supabaseAdmin.from('emails').update(updates).in('thread_id', threadIds);
  if (error) {
    console.error('Failed to update email threads:', error);
    return res.status(500).json({ error: 'Failed to update email threads' });
  }

  return res.status(200).json({ success: true, threadIds, updates });
}
