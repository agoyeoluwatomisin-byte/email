import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-inbound-secret'];
  if (!secret || secret !== process.env.INBOUND_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { messageId, inReplyTo, from, to, subject, text, html, attachments } = req.body || {};

  if (!from || !to) {
    return res.status(400).json({ error: 'from and to are required' });
  }

  // Thread the message: if it's a reply to something we already have,
  // reuse that thread_id. Otherwise start a new thread.
  let threadId = randomUUID();

  if (inReplyTo) {
    const { data: parent } = await supabaseAdmin
      .from('emails')
      .select('thread_id')
      .eq('message_id', inReplyTo)
      .limit(1)
      .maybeSingle();

    if (parent) {
      threadId = parent.thread_id;
    }
  }

  const { error } = await supabaseAdmin.from('emails').insert({
    thread_id: threadId,
    direction: 'inbound',
    message_id: messageId,
    in_reply_to: inReplyTo,
    from_address: from,
    to_address: to,
    subject,
    text_body: text,
    html_body: html,
    folder: 'inbox',
    attachments: Array.isArray(attachments) ? attachments.slice(0, 10) : [],
  });

  if (error) {
    console.error('Failed to store inbound email:', error);
    return res.status(500).json({ error: 'Failed to store email' });
  }

  return res.status(200).json({ success: true });
}
