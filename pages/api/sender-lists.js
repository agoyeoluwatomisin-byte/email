import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireRole } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['admin']);
  if (!session) return;
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('sender_lists').select('*').order('value');
    if (error) return res.status(500).json({ error: 'Failed to load sender lists.' });
    return res.status(200).json({ entries: data || [] });
  }
  if (req.method === 'POST') {
    const value = String(req.body?.value || '').trim().toLowerCase().slice(0, 320);
    const listType = req.body?.listType === 'allow' ? 'allow' : req.body?.listType === 'block' ? 'block' : '';
    if (!value || !listType || (!value.includes('@') && value.includes(' '))) return res.status(400).json({ error: 'A valid address or domain and list type are required.' });
    const { data, error } = await supabaseAdmin.from('sender_lists').upsert({ value, list_type: listType }, { onConflict: 'value' }).select().single();
    if (error) return res.status(500).json({ error: 'Failed to save sender list entry.' });
    return res.status(200).json({ entry: data });
  }
  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin.from('sender_lists').delete().eq('id', String(req.query?.id || '').slice(0, 80));
    if (error) return res.status(500).json({ error: 'Failed to delete sender list entry.' });
    return res.status(200).json({ success: true });
  }
  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}
