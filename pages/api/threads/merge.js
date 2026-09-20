import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sourceThreadId = String(req.body?.sourceThreadId || '').slice(0, 80);
  const targetThreadId = String(req.body?.targetThreadId || '').slice(0, 80);
  if (!sourceThreadId || !targetThreadId || sourceThreadId === targetThreadId)
    return res.status(400).json({ error: 'Two different thread ids are required.' });
  const { error } = await supabaseAdmin
    .from('emails')
    .update({ thread_id: targetThreadId })
    .eq('thread_id', sourceThreadId);
  if (error) return res.status(500).json({ error: 'Failed to merge threads.' });
  await supabaseAdmin.from('thread_activity').insert({
    thread_id: targetThreadId,
    actor_email: session.user.email,
    activity_type: 'threads_merged',
    details: { sourceThreadId },
  });
  await supabaseAdmin.from('threads').delete().eq('thread_id', sourceThreadId);
  return res.status(200).json({ success: true, threadId: targetThreadId });
}
