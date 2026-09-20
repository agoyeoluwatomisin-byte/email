import { Resend } from 'resend';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';

const resend = new Resend(process.env.RESEND_API_KEY);

// Very simple in-memory rate limit (best-effort only - resets on cold start,
// and won't work across multiple serverless instances). Good enough to stop
// casual abuse; for real protection add Upstash/Redis or a captcha.
const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function isRateLimited(ip) {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now - entry.start > WINDOW_MS) hits.delete(key);
  }
  const entry = hits.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  hits.set(ip, entry);
  return entry.count > MAX_PER_WINDOW;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requireSession(req, res))) return;

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests, slow down.' });
  }

  const { to, cc, bcc, subject, message, replyTo, attachments } = req.body || {};

  if (!to || !subject || !message) {
    return res.status(400).json({ error: 'to, subject, and message are required' });
  }

  if (!process.env.RESEND_FROM_ADDRESS) {
    return res.status(500).json({ error: 'RESEND_FROM_ADDRESS is not configured.' });
  }

  const normalizeList = (value) => {
    if (!value) return [];
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const normalizedMessage = String(message).trim();
  const normalizedSubject = String(subject).trim();
  const spamSignals = /(viagra|cialis|free money|earn.*\$|limited time offer|urgent cash)/i;

  if (spamSignals.test(normalizedSubject) || spamSignals.test(normalizedMessage)) {
    return res.status(400).json({ error: 'Message looks like spam and is blocked for safety.' });
  }

  const upperRatio = (normalizedMessage.match(/[A-Z]/g) || []).length / Math.max(normalizedMessage.length, 1);
  if (upperRatio > 0.35) {
    return res.status(400).json({ error: 'Avoid excessive uppercase text in outbound emails.' });
  }

  const recipientList = normalizeList(to);
  if (recipientList.length === 0) {
    return res.status(400).json({ error: 'At least one valid recipient is required.' });
  }

  const ccList = normalizeList(cc);
  const bccList = normalizeList(bcc);
  const allRecipients = [...recipientList, ...ccList, ...bccList];

  if ([...allRecipients, ...(replyTo ? [replyTo] : [])].some((recipient) => !isEmail(recipient))) {
    return res.status(400).json({ error: 'Every recipient and reply-to address must be valid.' });
  }

  if (allRecipients.length > 10) {
    return res.status(400).json({ error: 'Bulk recipient lists are blocked to reduce spam risk.' });
  }

  // Optional allow-list of recipients, set via ALLOWED_RECIPIENTS env var
  const allowed = (process.env.ALLOWED_RECIPIENTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const allowedRecipients = [...recipientList, ...ccList, ...bccList];
  if (allowed.length > 0 && allowedRecipients.some((recipient) => !allowed.includes(recipient))) {
    return res.status(403).json({ error: 'One or more recipients are not allowed' });
  }

  const textBody = normalizedMessage || '(empty message)';
  const htmlBody = `<p>${escapeHtml(normalizedMessage).replace(/\n/g, '<br/>')}</p>`;

  try {
    const fromEmail = (process.env.RESEND_FROM_ADDRESS.match(/<(.+)>/)?.[1] || process.env.RESEND_FROM_ADDRESS).trim();
    const messageId = `<${randomUUID()}@${fromEmail.split('@')[1] || 'localhost'}>`;
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_ADDRESS,
      to: recipientList,
      ...(ccList.length ? { cc: ccList } : {}),
      ...(bccList.length ? { bcc: bccList } : {}),
      subject: normalizedSubject,
      text: textBody,
      html: htmlBody,
      ...(replyTo ? { reply_to: replyTo } : {}),
      headers: {
        'Message-ID': messageId,
        'X-Entity-Ref-ID': `mail-${Date.now()}`,
      },
      ...(Array.isArray(attachments) && attachments.length
        ? {
            attachments: attachments.map((attachment) => ({
              filename: attachment.name || 'attachment',
              content: attachment.content || '',
              contentType: attachment.contentType || 'application/octet-stream',
            })),
          }
        : {}),
    });

    if (error) {
      return res.status(502).json({ error: error.message || 'Failed to send email' });
    }

    const threadId = randomUUID();
  await supabaseAdmin.from('threads').upsert({ thread_id: threadId }, { onConflict: 'thread_id', ignoreDuplicates: true });
    const { error: storeError } = await supabaseAdmin.from('emails').insert({
      thread_id: threadId,
      direction: 'outbound',
      message_id: messageId,
      from_address: process.env.RESEND_FROM_ADDRESS,
      to_address: recipientList.join(', '),
      subject: normalizedSubject,
      text_body: textBody,
      html_body: htmlBody,
      folder: 'sent',
      attachments: Array.isArray(attachments)
        ? attachments.slice(0, 10).map((attachment) => ({
            name: attachment.name || 'attachment',
            contentType: attachment.contentType || 'application/octet-stream',
        size: attachment.size || 0,
            content: attachment.content || '',
          }))
        : [],
    });

    if (storeError) {
      console.error('Email sent but could not be stored:', storeError);
      return res.status(502).json({ error: 'Email sent, but could not be added to Outbox.' });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}
