import { randomUUID } from 'crypto';
import { Resend } from 'resend';
import { supabaseAdmin } from './supabaseAdmin';
import { loadAttachmentContent } from './attachments';
import { sanitizeEmailHtml } from './emailContent';

function extractEmail(value) {
  return (String(value || '').match(/<([^>]+)>/)?.[1] || String(value || '')).trim();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extractEmail(value));
}

export async function sendOutboundEmail({
  userId,
  threadId,
  to,
  cc,
  bcc,
  from: fromOverride,
  replyTo,
  subject,
  text,
  html,
  attachments = [],
  inReplyTo,
  references,
}) {
  // `fromOverride` must already be validated by the caller (see pages/api/reply.js).
  const from = fromOverride || process.env.RESEND_FROM_ADDRESS;
  if (!from || !process.env.RESEND_API_KEY) throw new Error('Sending email is not configured.');
  if (!isEmail(from)) throw new Error('From must be a valid email address.');
  const recipients = [...(Array.isArray(to) ? to : [to]), ...(cc || []), ...(bcc || [])].filter(Boolean);
  if (!recipients.length || recipients.some((address) => !isEmail(address)))
    throw new Error('Every recipient must be a valid email address.');
  if (replyTo && !isEmail(replyTo)) throw new Error('Reply-to must be a valid email address.');

  const fromEmail = extractEmail(from);
  const messageId = `<${randomUUID()}@${fromEmail.split('@')[1] || 'localhost'}>`;
  const resendAttachments = [];
  const storedAttachments = [];
  for (const attachment of Array.isArray(attachments) ? attachments.slice(0, 10) : []) {
    const content = attachment.content
      ? Buffer.from(attachment.content, 'base64')
      : await loadAttachmentContent(attachment);
    if (!content) throw new Error(`Attachment ${attachment.filename || attachment.name || 'file'} is unavailable.`);
    resendAttachments.push({
      filename: attachment.filename || attachment.name || 'attachment',
      content,
      contentType: attachment.content_type || attachment.contentType || 'application/octet-stream',
    });
    storedAttachments.push({
      id: attachment.id,
      path: attachment.path,
      bucket: attachment.bucket,
      filename: attachment.filename || attachment.name || 'attachment',
      mimeType: attachment.content_type || attachment.contentType || 'application/octet-stream',
      size: attachment.size || content.length,
    });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    ...(cc?.length ? { cc } : {}),
    ...(bcc?.length ? { bcc } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
    subject: String(subject || '')
      .trim()
      .slice(0, 998),
    text: String(text || '')
      .trim()
      .slice(0, 100000),
    html: sanitizeEmailHtml(html || `<p>${String(text || '').replace(/\n/g, '<br>')}</p>`),
    headers: {
      'Message-ID': messageId,
      ...(inReplyTo ? { 'In-Reply-To': inReplyTo } : {}),
      ...(references ? { References: references } : {}),
    },
    ...(resendAttachments.length ? { attachments: resendAttachments } : {}),
  });
  if (result.error) throw new Error(result.error.message || 'Failed to send email.');

  const actualThreadId = threadId || randomUUID();
  const { error: threadError } = await supabaseAdmin
    .from('threads')
    .upsert({ thread_id: actualThreadId }, { onConflict: 'thread_id', ignoreDuplicates: true });
  if (threadError) throw threadError;
  const { data: stored, error: storeError } = await supabaseAdmin
    .from('emails')
    .insert({
      thread_id: actualThreadId,
      direction: 'outbound',
      message_id: messageId,
      in_reply_to: inReplyTo || null,
      from_address: from,
      to_address: [Array.isArray(to) ? to.join(', ') : to, ...(cc || []).map((item) => `cc:${item}`)].join(', '),
      subject: String(subject || '')
        .trim()
        .slice(0, 998),
      text_body: String(text || '')
        .trim()
        .slice(0, 100000),
      html_body: sanitizeEmailHtml(html || ''),
      folder: 'sent',
      attachments: storedAttachments,
    })
    .select('id')
    .single();
  if (storeError) throw storeError;
  return { id: result.data?.id, messageId, threadId: actualThreadId, emailId: stored.id, userId };
}