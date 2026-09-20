import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method === 'GET') {
    const { data } = await supabaseAdmin.from('integration_settings').select('webhook_url, browser_notifications').eq('user_id', session.user.id).maybeSingle();
    return res.status(200).json({ settings: data || { webhook_url: '', browser_notifications: false } });
  }
  if (req.method === 'PUT') {
    const values = { user_id: session.user.id, webhook_url: String(req.body?.webhookUrl || '').slice(0, 1000) || null, webhook_secret: String(req.body?.webhookSecret || '').slice(0, 200) || null, browser_notifications: Boolean(req.body?.browserNotifications), updated_at: new Date().toISOString() };
    if (values.webhook_url && !/^https:\/\//i.test(values.webhook_url)) return res.status(400).json({ error: 'Webhook URL must use HTTPS.' });
    const { error } = await supabaseAdmin.from('integration_settings').upsert(values, { onConflict: 'user_id' });
    if (error) return res.status(500).json({ error: 'Failed to save integration settings.' });
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
