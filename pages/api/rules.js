import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireRole } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['admin']);
  if (!session) return;
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('rules').select('*').order('order_index');
    if (error) return res.status(500).json({ error: 'Failed to load rules.' });
    return res.status(200).json({ rules: data || [] });
  }
  if (req.method === 'POST' || req.method === 'PATCH') {
    const body = req.body || {};
    const name = String(body.name || '').trim().slice(0, 160);
    if (!name || typeof body.conditions !== 'object' || typeof body.actions !== 'object') return res.status(400).json({ error: 'Name, conditions, and actions are required.' });
    const values = { name, conditions: body.conditions, actions: body.actions, enabled: body.enabled !== false, order_index: Math.max(0, Math.min(10000, Number(body.order_index) || 0)), updated_at: new Date().toISOString() };
    const query = req.method === 'POST' ? supabaseAdmin.from('rules').insert(values).select().single() : supabaseAdmin.from('rules').update(values).eq('id', String(body.id || '').slice(0, 80)).select().single();
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Failed to save rule.' });
    return res.status(200).json({ rule: data });
  }
  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin.from('rules').delete().eq('id', String(req.query?.id || '').slice(0, 80));
    if (error) return res.status(500).json({ error: 'Failed to delete rule.' });
    return res.status(200).json({ success: true });
  }
  res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}
