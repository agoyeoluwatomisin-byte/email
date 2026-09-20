import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireSession } from '../../../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const threadId = String(req.query?.id || '').slice(0, 80);
  const until = req.body?.until ? new Date(String(req.body.until)) : null;
  if (
    !until ||
    Number.isNaN(until.getTime()) ||
    until.getTime() < Date.now() ||
    until.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000
  )
    return res.status(400).json({ error: 'A valid future snooze time is required.' });
  const { error } = await supabaseAdmin
    .from('threads')
    .update({ snoozed_until: until.toISOString(), updated_at: new Date().toISOString() })
    .eq('thread_id', threadId);
  if (error) return res.status(500).json({ error: 'Failed to snooze thread.' });
  return res.status(200).json({ success: true, snoozedUntil: until.toISOString() });
}
