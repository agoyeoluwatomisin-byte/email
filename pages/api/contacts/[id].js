import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  const id = String(req.query?.id || '').slice(0, 80);
  const { data: contact, error } = await supabaseAdmin.from('contacts').select('*').eq('id', id).maybeSingle();
  if (error || !contact) return res.status(404).json({ error: 'Contact not found.' });
  if (req.method === 'GET') {
    const { data: history } = await supabaseAdmin.from('emails').select('id, thread_id, direction, subject, received_at').eq('contact_id', id).order('received_at', { ascending: false }).limit(100);
    return res.status(200).json({ contact, history: history || [] });
  }
  if (req.method === 'PATCH') {
    const values = { name: String(req.body?.name || '').slice(0, 160), company: String(req.body?.company || '').slice(0, 160), phone: String(req.body?.phone || '').slice(0, 60), notes: String(req.body?.notes || '').slice(0, 10000), vip: Boolean(req.body?.vip), updated_at: new Date().toISOString() };
    const { data, error: updateError } = await supabaseAdmin.from('contacts').update(values).eq('id', id).select().single();
    if (updateError) return res.status(500).json({ error: 'Failed to update contact.' });
    return res.status(200).json({ contact: data });
  }
  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ error: 'Method not allowed' });
}
