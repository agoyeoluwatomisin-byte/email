import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';
import { sendOutboundEmail } from '../../lib/sendOutbound';
import { sanitizeEmailHtml } from '../../lib/emailContent';
import { consumeRateLimit } from '../../lib/rateLimit';

// Very simple in-memory rate limit (best-effort only - resets on cold start,
// and won't work across multiple serverless instances). Good enough to stop
// casual abuse; for real protection add Upstash/Redis or a captcha.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await requireSession(req, res);
  if (!session) return;

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';

  if (await consumeRateLimit(ip, MAX_PER_WINDOW, WINDOW_MS)) {
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

  const { data: signature } = await supabaseAdmin
    .from('user_signatures')
    .select('signature_html, signature_text')
    .eq('user_id', session.user.id)
    .maybeSingle();
  const textBody = `${normalizedMessage || '(empty message)'}${signature?.signature_text ? `\n\n${signature.signature_text}` : ''}`;
  const htmlBody = sanitizeEmailHtml(
    `<p>${escapeHtml(normalizedMessage).replace(/\n/g, '<br/>')}</p>${signature?.signature_html || ''}`,
  );

  try {
    const result = await sendOutboundEmail({
      userId: session.user.id,
      to: recipientList,
      cc: ccList,
      bcc: bccList,
      replyTo,
      subject: normalizedSubject,
      text: textBody,
      html: htmlBody,
      attachments,
    });
    return res
      .status(200)
      .json({ success: true, id: result.id, messageId: result.messageId, threadId: result.threadId });
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
