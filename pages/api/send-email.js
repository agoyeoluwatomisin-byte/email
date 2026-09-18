import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Very simple in-memory rate limit (best-effort only - resets on cold start,
// and won't work across multiple serverless instances). Good enough to stop
// casual abuse; for real protection add Upstash/Redis or a captcha.
const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function isRateLimited(ip) {
  const now = Date.now();
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

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests, slow down.' });
  }

  const { to, subject, message, replyTo } = req.body || {};

  if (!to || !subject || !message) {
    return res.status(400).json({ error: 'to, subject, and message are required' });
  }

  // Optional allow-list of recipients, set via ALLOWED_RECIPIENTS env var
  const allowed = (process.env.ALLOWED_RECIPIENTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length > 0 && !allowed.includes(to)) {
    return res.status(403).json({ error: 'Recipient not allowed' });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_ADDRESS,
      to: [to],
      subject,
      html: `<p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>`,
      ...(replyTo ? { reply_to: replyTo } : {}),
    });

    if (error) {
      return res.status(502).json({ error: error.message || 'Failed to send email' });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (err) {
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
