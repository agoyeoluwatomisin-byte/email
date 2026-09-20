import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('notifications').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(50);
    if (error) return res.status(500).json({ error: 'Failed to load notifications.' });
    return res.status(200).json({ notifications: data || [], unread: (data || []).filter((item) => !item.read_at).length });
  }
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const id = req.body?.id ? String(req.body.id).slice(0, 80) : null;
  const query = supabaseAdmin.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', session.user.id);
  if (id) query.eq('id', id);
  const { error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to mark notification read.' });
  return res.status(200).json({ success: true });
}
