import { randomUUID } from 'crypto';
import { Resend } from 'resend';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);

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

  const label = deriveInboundLabel(to);

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

  const storedAttachments = await storeInboundAttachments(threadId, attachments);
  if (storedAttachments.error) {
    console.error('Failed to store inbound attachments:', storedAttachments.error);
    return res.status(502).json({ error: 'Failed to store inbound attachments' });
  }

  const { error } = await supabaseAdmin.from('emails').insert({
    thread_id: threadId,
    direction: 'inbound',
    message_id: messageId,
    in_reply_to: inReplyTo,
    from_address: from,
    sender_domain: deriveSenderDomain(from),
    to_address: to,
    subject,
    text_body: text,
    html_body: html,
    folder: 'inbox',
    label,
    attachments: storedAttachments.files,
  });

  if (error) {
    console.error('Failed to store inbound email:', error);
    return res.status(500).json({ error: 'Failed to store email' });
  }

  await notifyInboundEmail({ from, to, subject, text, threadId });

  return res.status(200).json({ success: true });
}

async function storeInboundAttachments(threadId, attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return { files: [] };
  }

  const files = [];
  const bucket = process.env.SUPABASE_ATTACHMENTS_BUCKET || 'email-attachments';

  for (const attachment of attachments.slice(0, 10)) {
    if (!attachment?.content) continue;

    const filename = safeFilename(attachment.filename || attachment.name || 'attachment');
    const path = `${threadId}/${randomUUID()}-${filename}`;
    const content = Buffer.from(attachment.content, 'base64');
    const { error } = await supabaseAdmin.storage.from(bucket).upload(path, content, {
      contentType: attachment.mimeType || attachment.contentType || 'application/octet-stream',
      upsert: false,
    });

    if (error) return { files: [], error };

    files.push({
      path,
      bucket,
      filename,
      mimeType: attachment.mimeType || attachment.contentType || 'application/octet-stream',
      size: attachment.size || content.length,
    });
  }

  return { files };
}

function safeFilename(filename) {
  return String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function notifyInboundEmail({ from, to, subject, text, threadId }) {
  const recipient = process.env.INBOUND_NOTIFICATION_EMAIL;
  const sender = process.env.RESEND_FROM_ADDRESS;

  if (!recipient || !sender || !process.env.RESEND_API_KEY) {
    return;
  }

  try {
    const preview = String(text || '').trim().slice(0, 1000) || '(no message text)';
    const safeSubject = String(subject || '(no subject)').trim();
    const result = await resend.emails.send({
      from: sender,
      to: [recipient],
      subject: `New inbound email: ${safeSubject}`,
      text: `New email received\n\nFrom: ${from}\nTo: ${to}\nSubject: ${safeSubject}\nThread: ${threadId}\n\n${preview}`,
      html: `<p><strong>New email received</strong></p><p><strong>From:</strong> ${escapeHtml(from)}<br/><strong>To:</strong> ${escapeHtml(to)}<br/><strong>Subject:</strong> ${escapeHtml(safeSubject)}<br/><strong>Thread:</strong> ${escapeHtml(threadId)}</p><p>${escapeHtml(preview).replace(/\n/g, '<br/>')}</p>`,
    });

    if (result.error) {
      console.error('Inbound notification failed:', result.error);
    }
  } catch (error) {
    console.error('Inbound notification error:', error);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function deriveInboundLabel(value) {
  const address = String(value)
    .toLowerCase()
    .match(/<([^>]+)>/)?.[1] || String(value).split(/[;,]/)[0];
  const localPart = address.trim().replace(/^mailto:/, '').split('@')[0].replace(/[^a-z0-9._+-]/g, '');

  if (localPart.includes('sales')) return 'sales';
  if (localPart.includes('support')) return 'support';
  if (localPart.includes('billing') || localPart.includes('invoice')) return 'billing';
  return localPart || 'other';
}

function deriveSenderDomain(value) {
  const address = String(value).toLowerCase().match(/<([^>]+)>/)?.[1] || String(value).split(/[;,]/)[0];
  return address.trim().replace(/^mailto:/, '').split('@')[1]?.replace(/[^a-z0-9.-]/g, '') || null;
}
