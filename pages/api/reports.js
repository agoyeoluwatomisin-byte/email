import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireRole } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['admin']);
  if (!session) return;
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('report_settings').select('*').eq('id', true).maybeSingle();
    if (error) return res.status(500).json({ error: 'Failed to load report settings.' });
    return res.status(200).json({ settings: data || { id: true, enabled: false, recipient_emails: [], weekday: 1, hour: 9 } });
  }
  if (req.method === 'PUT') {
    const recipients = Array.isArray(req.body?.recipientEmails) ? req.body.recipientEmails.map((email) => String(email).trim().toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).slice(0, 20) : [];
    const weekday = Math.max(0, Math.min(6, Number(req.body?.weekday) || 1));
    const hour = Math.max(0, Math.min(23, Number(req.body?.hour) || 9));
    const { data, error } = await supabaseAdmin.from('report_settings').upsert({ id: true, enabled: Boolean(req.body?.enabled), recipient_emails: recipients, weekday, hour, updated_at: new Date().toISOString() }, { onConflict: 'id' }).select().single();
    if (error) return res.status(500).json({ error: 'Failed to save report settings.' });
    return res.status(200).json({ settings: data });
  }
  res.setHeader('Allow', ['GET', 'PUT']);
  return res.status(405).json({ error: 'Method not allowed' });
}
