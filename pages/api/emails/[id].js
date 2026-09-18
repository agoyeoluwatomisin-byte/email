import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (!['DELETE', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', ['DELETE', 'PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query || {};
  if (!id) {
    return res.status(400).json({ error: 'Email thread id is required' });
  }

  if (req.method === 'PATCH') {
    const { read } = req.body || {};
    if (typeof read !== 'boolean') {
      return res.status(400).json({ error: 'read must be a boolean' });
    }

    const { error } = await supabaseAdmin
      .from('emails')
      .update({ read })
      .eq('thread_id', id)
      .eq('direction', 'inbound');

    if (error) {
      console.error('Failed to update email read state:', error);
      return res.status(500).json({ error: 'Failed to update read state' });
    }

    return res.status(200).json({ success: true, threadId: id, read });
  }

  const { error } = await supabaseAdmin.from('emails').delete().eq('thread_id', id);

  if (error) {
    console.error('Failed to delete email thread:', error);
    return res.status(500).json({ error: 'Failed to delete email thread' });
  }

  return res.status(200).json({ success: true, threadId: id });
}