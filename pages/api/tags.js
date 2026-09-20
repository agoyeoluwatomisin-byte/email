import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('tags').select('*').order('name');
    if (error) return res.status(500).json({ error: 'Failed to load tags.' });
    return res.status(200).json({ tags: data || [] });
  }
  if (req.method === 'POST') {
    const name = String(req.body?.name || '').trim().slice(0, 60);
    const color = String(req.body?.color || '#38bdf8').trim().slice(0, 20);
    if (!name || !/^#[0-9a-f]{6}$/i.test(color)) return res.status(400).json({ error: 'Tag name and six-digit color are required.' });
    const { data, error } = await supabaseAdmin.from('tags').upsert({ name, color }, { onConflict: 'name' }).select().single();
    if (error) return res.status(500).json({ error: 'Failed to save tag.' });
    return res.status(200).json({ tag: data });
  }
  if (req.method === 'DELETE') {
    const id = String(req.query?.id || '').slice(0, 80);
    const { error } = await supabaseAdmin.from('tags').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete tag.' });
    return res.status(200).json({ success: true });
  }
  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}
