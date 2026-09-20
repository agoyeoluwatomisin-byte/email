import { randomUUID } from 'crypto';
import { Resend } from 'resend';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);
const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigins = String(process.env.CONTACT_WIDGET_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, origin, allowedOrigins);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['OPTIONS', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAllowedOrigin(origin, allowedOrigins)) {
    return res.status(403).json({ error: 'Origin is not allowed' });
  }
  setCorsHeaders(res, origin, allowedOrigins);

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests, slow down.' });
  }

  const { name, email, subject, message, website } = req.body || {};
  if (website) return res.status(200).json({ success: true });

  const visitorEmail = String(email || '').trim().toLowerCase();
  const visitorName = String(name || '').trim().slice(0, 120);
  const visitorMessage = String(message || '').trim().slice(0, 5000);
  const cleanSubject = String(subject || 'Website contact').trim().slice(0, 180);
  const destination = process.env.CONTACT_WIDGET_TO_EMAIL;

  if (!destination || !process.env.RESEND_FROM_ADDRESS || !process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Contact widget email is not configured.' });
  }

  if (!visitorName || !isEmail(visitorEmail) || !visitorMessage) {
    return res.status(400).json({ error: 'Name, valid email, and message are required.' });
  }

  const spamSignals = /(viagra|cialis|bitcoin|crypto|free money|click here|earn.*\$|urgent cash)/i;
  if (spamSignals.test(`${cleanSubject} ${visitorMessage}`)) {
    return res.status(400).json({ error: 'Message looks like spam and was blocked.' });
  }

  const threadId = randomUUID();
  const textBody = `Name: ${visitorName}\nEmail: ${visitorEmail}\n\n${visitorMessage}`;
  const htmlBody = `<p><strong>Name:</strong> ${escapeHtml(visitorName)}<br/><strong>Email:</strong> ${escapeHtml(visitorEmail)}</p><p>${escapeHtml(visitorMessage).replace(/\n/g, '<br/>')}</p>`;

  try {
    const senderEmail = (process.env.RESEND_FROM_ADDRESS.match(/<(.+)>/)?.[1] || process.env.RESEND_FROM_ADDRESS).trim();
    const widgetMessageId = `<${randomUUID()}@${senderEmail.split('@')[1] || 'localhost'}>`;
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_ADDRESS,
      to: [destination],
      reply_to: visitorEmail,
      subject: `[Website] ${cleanSubject}`,
      text: textBody,
      html: htmlBody,
      headers: { 'X-Agosoft-Widget': '1', 'X-Entity-Ref-ID': `widget-${Date.now()}` },
    });

    if (error) return res.status(502).json({ error: error.message || 'Failed to send contact message.' });

    await supabaseAdmin.from('threads').upsert({ thread_id: threadId }, { onConflict: 'thread_id', ignoreDuplicates: true });
    // inbound.js ignores the notification if Cloudflare routes it back with X-Agosoft-Widget.
    const { error: storeError } = await supabaseAdmin.from('emails').insert({
      thread_id: threadId,
      direction: 'inbound',
      message_id: widgetMessageId,
      from_address: visitorEmail,
      to_address: destination,
      subject: `[Website] ${cleanSubject}`,
      text_body: textBody,
      html_body: htmlBody,
      folder: 'inbox',
      label: 'website',
      sender_domain: visitorEmail.split('@')[1],
      attachments: [],
    });

    if (storeError) console.error('Contact message sent but could not be stored:', storeError);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Contact widget error:', error);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
}

function isAllowedOrigin(origin, allowedOrigins) {
  return Boolean(origin) && (allowedOrigins.includes(origin) || (allowedOrigins.includes('*') && process.env.CONTACT_WIDGET_ALLOW_ANY_ORIGIN === 'true'));
}

function setCorsHeaders(res, origin, allowedOrigins) {
  if (isAllowedOrigin(origin, allowedOrigins)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

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

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
