import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('saved_views')
      .select('*')
      .eq('user_id', session.user.id)
      .order('name')
      .limit(100);
    if (error) return res.status(500).json({ error: 'Failed to load saved views.' });
    return res.status(200).json({ views: data || [] });
  }
  if (req.method === 'POST') {
    const name = String(req.body?.name || '')
      .trim()
      .slice(0, 100);
    if (!name || typeof req.body?.filters !== 'object')
      return res.status(400).json({ error: 'Name and filters are required.' });
    const { data, error } = await supabaseAdmin
      .from('saved_views')
      .insert({ user_id: session.user.id, name, filters: req.body.filters })
      .select()
      .single();
    if (error) return res.status(500).json({ error: 'Failed to save view.' });
    return res.status(200).json({ view: data });
  }
  if (req.method === 'DELETE') {
    const id = String(req.query?.id || '').slice(0, 80);
    const { error } = await supabaseAdmin.from('saved_views').delete().eq('id', id).eq('user_id', session.user.id);
    if (error) return res.status(500).json({ error: 'Failed to delete view.' });
    return res.status(200).json({ success: true });
  }
  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}
