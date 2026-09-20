import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { createSessionToken, hashSessionToken, setSessionCookie } from '../../../lib/auth';
import { randomUUID, createHmac } from 'crypto';
import { consumeRateLimit } from '../../../lib/rateLimit';

const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_ATTEMPTS = 5;
const DUMMY_PASSWORD_HASH = '$2b$12$nuBB0vDuw6cWYxblXzTNA.Veol5u8tSGioOOqGqEzJVgprMumnpv6';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (await consumeRateLimit(`${ip}:${email}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS))
    return res.status(429).json({ error: 'Too many login attempts, slow down.' });

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, password_hash, display_name, active, role, totp_secret, totp_enabled, recovery_codes')
    .eq('email', email)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    console.error('Failed to load login user:', error);
    return res.status(500).json({ error: 'Unable to sign in.' });
  }

  const passwordMatches = await bcrypt.compare(password, user?.password_hash || DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.totp_enabled) {
    const code = String(req.body?.twoFactorCode || '').trim();
    if (!verifyTotp(user.totp_secret, code) && !(user.recovery_codes || []).includes(code)) {
      return res.status(401).json({ error: 'Two-factor code required.', twoFactorRequired: true });
    }
  }

  try {
    const sessionId = randomUUID();
    const sessionToken = createSessionToken({ ...user, sessionId });
    const { error: sessionError } = await supabaseAdmin.from('user_sessions').insert({
      id: sessionId,
      user_id: user.id,
      token_hash: hashSessionToken(sessionToken),
      user_agent: req.headers['user-agent']?.slice(0, 500),
      ip_address: ip,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (sessionError) throw sessionError;
    setSessionCookie(res, sessionToken);
  } catch (sessionError) {
    console.error('Failed to create session:', sessionError);
    return res.status(500).json({ error: 'Session configuration is missing.' });
  }

  return res.status(200).json({
    success: true,
    user: { id: user.id, email: user.email, displayName: user.display_name },
  });
}

function verifyTotp(secret, code) {
  if (!secret || !/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(Date.now() / 30000);
  return [-1, 0, 1].some((offset) => totp(secret, counter + offset) === code);
}

function totp(secret, counter) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of String(secret).toUpperCase().replace(/=+$/, ''))
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const key = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < key.length; i += 1) key[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
