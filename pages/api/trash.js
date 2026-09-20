import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const action = String(req.body?.action || '');
  if (action === 'restore') {
    const ids = Array.isArray(req.body?.threadIds) ? req.body.threadIds.map((id) => String(id).slice(0, 80)).slice(0, 100) : [];
    if (!ids.length) return res.status(400).json({ error: 'Thread ids are required.' });
    const { error } = await supabaseAdmin.from('emails').update({ folder: 'inbox', deleted_at: null }).in('thread_id', ids);
    if (error) return res.status(500).json({ error: 'Failed to restore messages.' });
    return res.status(200).json({ success: true });
  }
  if (action === 'empty') {
    const { error } = await supabaseAdmin.from('emails').delete().eq('folder', 'trash');
    if (error) return res.status(500).json({ error: 'Failed to empty trash.' });
    return res.status(200).json({ success: true });
  }
  return res.status(400).json({ error: 'Unsupported trash action.' });
}
