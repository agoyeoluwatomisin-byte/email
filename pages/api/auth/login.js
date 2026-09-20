import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { createSessionToken, setSessionCookie } from '../../../lib/auth';

const loginHits = new Map();
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_ATTEMPTS = 5;
const DUMMY_PASSWORD_HASH = '$2b$12$nuBB0vDuw6cWYxblXzTNA.Veol5u8tSGioOOqGqEzJVgprMumnpv6';

function isRateLimited(key) {
  const now = Date.now();
  for (const [entryKey, entry] of loginHits) {
    if (now - entry.start > LOGIN_WINDOW_MS) loginHits.delete(entryKey);
  }
  const entry = loginHits.get(key) || { count: 0, start: now };
  if (now - entry.start > LOGIN_WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  loginHits.set(key, entry);
  return entry.count > LOGIN_MAX_ATTEMPTS;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(`${ip}:${email}`)) return res.status(429).json({ error: 'Too many login attempts, slow down.' });

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, password_hash, display_name, active')
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

  try {
    setSessionCookie(res, createSessionToken(user));
  } catch (sessionError) {
    console.error('Failed to create session:', sessionError);
    return res.status(500).json({ error: 'Session configuration is missing.' });
  }

  return res.status(200).json({
    success: true,
    user: { id: user.id, email: user.email, displayName: user.display_name },
  });
}
