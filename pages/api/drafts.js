import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const threadId = req.query?.threadId ? String(req.query.threadId).slice(0, 80) : null;
    let query = supabaseAdmin.from('email_drafts').select('*').eq('user_id', session.user.id).order('updated_at', { ascending: false }).limit(100);
    if (threadId) query = query.eq('thread_id', threadId);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Failed to load drafts.' });
    return res.status(200).json({ drafts: data || [] });
  }

  if (req.method === 'DELETE') {
    const id = String(req.query?.id || '').slice(0, 80);
    if (!id) return res.status(400).json({ error: 'Draft id is required.' });
    const { error } = await supabaseAdmin.from('email_drafts').delete().eq('id', id).eq('user_id', session.user.id);
    if (error) return res.status(500).json({ error: 'Failed to delete draft.' });
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const id = body.id ? String(body.id).slice(0, 80) : undefined;
  const kind = ['compose', 'reply', 'forward'].includes(body.kind) ? body.kind : 'compose';
  const fields = {
    user_id: session.user.id,
    thread_id: body.threadId ? String(body.threadId).slice(0, 80) : null,
    kind,
    to_address: String(body.to || '').slice(0, 4000),
    cc: String(body.cc || '').slice(0, 4000),
    bcc: String(body.bcc || '').slice(0, 4000),
    reply_to: String(body.replyTo || '').slice(0, 320),
    subject: String(body.subject || '').slice(0, 998),
    text_body: String(body.message || '').slice(0, 100000),
    html_body: String(body.html || '').slice(0, 200000),
    attachments: Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [],
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? supabaseAdmin.from('email_drafts').update(fields).eq('id', id).eq('user_id', session.user.id).select().maybeSingle()
    : supabaseAdmin.from('email_drafts').insert(fields).select().single();
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to save draft.' });
  return res.status(200).json({ draft: data });
}
