import { Resend } from 'resend';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers['x-cron-secret'];
  if (!process.env.SCHEDULED_TASK_SECRET || provided !== process.env.SCHEDULED_TASK_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  const { data: settings } = await supabaseAdmin.from('report_settings').select('*').eq('id', true).maybeSingle();
  if (!settings?.enabled || !settings.recipient_emails?.length)
    return res.status(200).json({ sent: false, reason: 'disabled' });
  const now = new Date();
  if (
    now.getUTCDay() !== settings.weekday ||
    now.getUTCHours() !== settings.hour ||
    (settings.last_sent_at && now - new Date(settings.last_sent_at) < 6 * 24 * 60 * 60 * 1000)
  )
    return res.status(200).json({ sent: false, reason: 'outside schedule' });
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { data: emails } = await supabaseAdmin
    .from('emails')
    .select('direction, label')
    .gte('received_at', from.toISOString())
    .lte('received_at', now.toISOString())
    .limit(10000);
  const { data: csat } = await supabaseAdmin
    .from('csat_responses')
    .select('rating')
    .gte('created_at', from.toISOString())
    .lte('created_at', now.toISOString());
  const inbound = (emails || []).filter((email) => email.direction === 'inbound').length;
  const outbound = (emails || []).filter((email) => email.direction === 'outbound').length;
  const averageCsat = csat?.length
    ? (csat.reduce((sum, item) => sum + item.rating, 0) / csat.length).toFixed(1)
    : 'n/a';
  const text = `Weekly email report\n\nInbound: ${inbound}\nOutbound: ${outbound}\nCSAT average: ${averageCsat}`;
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_ADDRESS)
    return res.status(500).json({ error: 'Resend is not configured.' });
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: process.env.RESEND_FROM_ADDRESS,
    to: settings.recipient_emails,
    subject: 'Weekly email report',
    text,
    html: `<h1>Weekly email report</h1><p>Inbound: ${inbound}</p><p>Outbound: ${outbound}</p><p>CSAT average: ${averageCsat}</p>`,
  });
  if (result.error) return res.status(502).json({ error: result.error.message || 'Failed to send report.' });
  await supabaseAdmin
    .from('report_settings')
    .update({ last_sent_at: now.toISOString(), updated_at: now.toISOString() })
    .eq('id', true);
  return res.status(200).json({ sent: true });
}
