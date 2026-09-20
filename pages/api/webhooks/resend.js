import crypto from 'crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const raw = await readBody(req);
  if (!verifySignature(req.headers, raw)) return res.status(401).json({ error: 'Invalid webhook signature.' });
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid webhook payload.' });
  }

  const eventType = String(payload.type || '').slice(0, 80);
  const eventData = payload.data || {};
  const messageId = String(eventData.message_id || eventData.email_id || '').slice(0, 500) || null;
  const allowed = new Set(['email.delivered', 'email.bounced', 'email.complained', 'email.opened']);
  if (!allowed.has(eventType)) return res.status(200).json({ received: true, ignored: true });

  let emailId = null;
  if (messageId) {
    const { data: email } = await supabaseAdmin.from('emails').select('id').eq('message_id', messageId).maybeSingle();
    emailId = email?.id || null;
  }
  const { error } = await supabaseAdmin.from('email_events').insert({ email_id: emailId, message_id: messageId, event_type: eventType, payload });
  if (error && error.code !== '23505') return res.status(500).json({ error: 'Failed to store webhook event.' });
  return res.status(200).json({ received: true });
}

function verifySignature(headers, raw) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const signature = headers['svix-signature'];
  const timestamp = headers['svix-timestamp'];
  const id = headers['svix-id'];
  if (!secret || !signature || !timestamp || !id) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 5 * 60) return false;
  const secretBytes = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', secretBytes).update(`${id}.${timestamp}.${raw}`).digest('base64');
  return String(signature).split(' ').some((item) => {
    const value = item.replace(/^v1,/, '');
    return value.length === expected.length && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected));
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
