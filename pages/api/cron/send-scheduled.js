import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { sendOutboundEmail } from '../../../lib/sendOutbound';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers['x-cron-secret'];
  if (!process.env.SCHEDULED_TASK_SECRET || provided !== process.env.SCHEDULED_TASK_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });

  await supabaseAdmin
    .from('threads')
    .update({ snoozed_until: null, updated_at: new Date().toISOString() })
    .lte('snoozed_until', new Date().toISOString());
  await supabaseAdmin
    .from('emails')
    .delete()
    .eq('folder', 'trash')
    .lt('deleted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const { data: jobs, error } = await supabaseAdmin
    .from('scheduled_emails')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(25);
  if (error) return res.status(500).json({ error: 'Failed to load scheduled messages.' });
  const results = [];
  for (const job of jobs || []) {
    const { data: claimed } = await supabaseAdmin
      .from('scheduled_emails')
      .update({ status: 'processing' })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (!claimed) continue;
    try {
      const payload = job.payload || {};
      const result = await sendOutboundEmail({
        userId: job.user_id,
        to: String(payload.to || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        cc: String(payload.cc || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        bcc: String(payload.bcc || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        replyTo: payload.replyTo,
        subject: payload.subject,
        text: payload.message,
        html: payload.html,
        attachments: payload.attachments,
      });
      await supabaseAdmin
        .from('scheduled_emails')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', job.id);
      results.push({ id: job.id, status: 'sent', messageId: result.messageId });
    } catch (sendError) {
      await supabaseAdmin
        .from('scheduled_emails')
        .update({ status: 'failed', error: String(sendError.message || 'Send failed').slice(0, 500) })
        .eq('id', job.id);
      results.push({ id: job.id, status: 'failed' });
    }
  }
  return res.status(200).json({ processed: results });
}
