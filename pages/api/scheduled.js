import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('scheduled_emails')
      .select('id, scheduled_at, status, payload, created_at')
      .eq('user_id', session.user.id)
      .order('scheduled_at', { ascending: true })
      .limit(100);
    if (error) return res.status(500).json({ error: 'Failed to load scheduled messages.' });
    return res.status(200).json({ scheduled: data || [] });
  }

  if (req.method === 'DELETE') {
    const id = String(req.query?.id || '').slice(0, 80);
    const { error } = await supabaseAdmin
      .from('scheduled_emails')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .eq('status', 'pending');
    if (error) return res.status(500).json({ error: 'Failed to cancel scheduled message.' });
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const scheduledAt = new Date(String(req.body?.scheduledAt || ''));
  if (
    Number.isNaN(scheduledAt.getTime()) ||
    scheduledAt.getTime() < Date.now() + 60_000 ||
    scheduledAt.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000
  ) {
    return res.status(400).json({ error: 'Choose a send time between one minute and one year from now.' });
  }
  const payload = req.body?.payload || {};
  const { data, error } = await supabaseAdmin
    .from('scheduled_emails')
    .insert({
      id: randomUUID(),
      user_id: session.user.id,
      scheduled_at: scheduledAt.toISOString(),
      payload: {
        to: String(payload.to || '').slice(0, 4000),
        cc: String(payload.cc || '').slice(0, 4000),
        bcc: String(payload.bcc || '').slice(0, 4000),
        replyTo: String(payload.replyTo || '').slice(0, 320),
        subject: String(payload.subject || '').slice(0, 998),
        message: String(payload.message || '').slice(0, 100000),
        html: String(payload.html || '').slice(0, 200000),
        attachments: Array.isArray(payload.attachments) ? payload.attachments.slice(0, 10) : [],
      },
    })
    .select('id, scheduled_at, status')
    .single();
  if (error) return res.status(500).json({ error: 'Failed to schedule email.' });
  return res.status(200).json({ scheduled: data });
}
