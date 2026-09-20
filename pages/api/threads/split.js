import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sourceThreadId = String(req.body?.sourceThreadId || '').slice(0, 80);
  const emailId = String(req.body?.emailId || '').slice(0, 80);
  if (!sourceThreadId || !emailId)
    return res.status(400).json({ error: 'Source thread and message ids are required.' });
  const newThreadId = randomUUID();
  const { error } = await supabaseAdmin
    .from('emails')
    .update({ thread_id: newThreadId })
    .eq('id', emailId)
    .eq('thread_id', sourceThreadId);
  if (error) return res.status(500).json({ error: 'Failed to split message.' });
  await supabaseAdmin
    .from('threads')
    .upsert({ thread_id: newThreadId }, { onConflict: 'thread_id', ignoreDuplicates: true });
  await supabaseAdmin.from('thread_activity').insert([
    {
      thread_id: sourceThreadId,
      actor_email: session.user.email,
      activity_type: 'thread_split',
      details: { emailId, newThreadId },
    },
    {
      thread_id: newThreadId,
      actor_email: session.user.email,
      activity_type: 'thread_split',
      details: { emailId, sourceThreadId },
    },
  ]);
  return res.status(200).json({ success: true, threadId: newThreadId });
}
