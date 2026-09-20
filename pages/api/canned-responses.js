import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    const title = String(req.body?.title || '').trim().slice(0, 160);
    const body = String(req.body?.body || '').trim().slice(0, 10000);
    const category = String(req.body?.category || 'General').trim().slice(0, 80) || 'General';
    if (!title || !body) return res.status(400).json({ error: 'Title and body are required.' });
    const id = String(req.body?.id || '').slice(0, 80);
    const query = req.method === 'POST'
      ? supabaseAdmin.from('canned_responses').insert({ title, body, category }).select().single()
      : supabaseAdmin.from('canned_responses').update({ title, body, category, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Failed to save canned response.' });
    return res.status(200).json({ response: data });
  }

  if (req.method === 'DELETE') {
    const id = String(req.query?.id || '').slice(0, 80);
    if (!id) return res.status(400).json({ error: 'Response id is required.' });
    const { error } = await supabaseAdmin.from('canned_responses').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete canned response.' });
    return res.status(200).json({ success: true });
  }

  if (!(await requireSession(req, res))) return;

  const { data, error } = await supabaseAdmin
    .from('canned_responses')
    .select('id, title, body, category')
    .order('title', { ascending: true });

  if (error) {
    console.error('Failed to load canned responses:', error);
    return res.status(500).json({ error: 'Failed to load canned responses' });
  }

  return res.status(200).json({ responses: data || [] });
}
