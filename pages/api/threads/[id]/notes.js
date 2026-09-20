import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireSession } from '../../../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  const threadId = String(req.query?.id || '').slice(0, 80);
  if (!threadId) return res.status(400).json({ error: 'Thread id is required.' });

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('thread_notes')
      .select('id, thread_id, author_id, body, created_at, updated_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: 'Failed to load notes.' });
    return res.status(200).json({ notes: data || [] });
  }
  if (req.method === 'DELETE') {
    const noteId = String(req.query?.noteId || '').slice(0, 80);
    const { error } = await supabaseAdmin
      .from('thread_notes')
      .delete()
      .eq('id', noteId)
      .eq('author_id', session.user.id);
    if (error) return res.status(500).json({ error: 'Failed to delete note.' });
    return res.status(200).json({ success: true });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const body = String(req.body?.body || '')
    .trim()
    .slice(0, 20000);
  if (!body) return res.status(400).json({ error: 'Note cannot be empty.' });
  const { data: note, error } = await supabaseAdmin
    .from('thread_notes')
    .insert({ thread_id: threadId, author_id: session.user.id, body })
    .select()
    .single();
  if (error) return res.status(500).json({ error: 'Failed to save note.' });

  const mentions = [
    ...new Set([...body.matchAll(/@([\w.+-]+@[\w.-]+|[\w.-]+)/g)].map((match) => match[1].toLowerCase())),
  ].slice(0, 20);
  if (mentions.length) {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .in('email', mentions)
      .eq('active', true);
    if (users?.length)
      await supabaseAdmin.from('notifications').insert(
        users.map((user) => ({
          user_id: user.id,
          thread_id: threadId,
          kind: 'mention',
          body: `${session.user.email} mentioned you in a thread note.`,
        })),
      );
  }
  return res.status(200).json({ note });
}
