import crypto from 'crypto';
import { requireSession } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method === 'POST') {
    const secret = randomBase32(20);
    const { error } = await supabaseAdmin
      .from('users')
      .update({ totp_secret: secret, totp_enabled: false, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);
    if (error) return res.status(500).json({ error: 'Failed to start 2FA setup.' });
    return res.status(200).json({
      secret,
      otpauth: `otpauth://totp/Agosoft:${encodeURIComponent(session.user.email)}?secret=${secret}&issuer=Agosoft`,
    });
  }
  if (req.method === 'PUT') {
    const { data: user } = await supabaseAdmin.from('users').select('totp_secret').eq('id', session.user.id).single();
    if (!verifyTotp(user?.totp_secret, String(req.body?.code || '')))
      return res.status(400).json({ error: 'Invalid authenticator code.' });
    const recoveryCodes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex'));
    const { error } = await supabaseAdmin
      .from('users')
      .update({ totp_enabled: true, recovery_codes: recoveryCodes, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);
    if (error) return res.status(500).json({ error: 'Failed to enable 2FA.' });
    return res.status(200).json({ success: true, recoveryCodes });
  }
  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ totp_enabled: false, totp_secret: null, recovery_codes: [], updated_at: new Date().toISOString() })
      .eq('id', session.user.id);
    if (error) return res.status(500).json({ error: 'Failed to disable 2FA.' });
    return res.status(200).json({ success: true });
  }
  res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}

function randomBase32(size) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  return [...crypto.randomBytes(size)].map((value) => alphabet[value % alphabet.length]).join('');
}

function verifyTotp(secret, code) {
  if (!secret || !/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(Date.now() / 30000);
  return [-1, 0, 1].some((offset) => totp(secret, counter + offset) === code);
}

function totp(secret, counter) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const key = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < key.length; i += 1) key[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
