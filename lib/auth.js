import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from './supabaseAdmin';

const COOKIE_NAME = 'email_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function createSessionToken(user) {
  const sessionId = user.sessionId || randomUUID();
  const payload = {
    id: user.id,
    email: user.email,
    sid: sessionId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token) {
  if (!token) return null;
  const [encoded, signature] = String(token).split('.');
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.id || !payload.email || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

export function getSessionFromRequest(req) {
  const cookies = String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim().split('='))
    .reduce((result, [key, ...value]) => ({ ...result, [key]: value.join('=') }), {});
  return verifySessionToken(cookies[COOKIE_NAME]);
}

export async function requireSession(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, display_name, active, role')
    .eq('id', session.id)
    .eq('active', true)
    .maybeSingle();

  if (error || !user || !session.sid) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }

  const { data: activeSession, error: sessionError } = await supabaseAdmin
    .from('user_sessions')
    .select('id')
    .eq('id', session.sid)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (sessionError || !activeSession) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  await supabaseAdmin.from('user_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', session.sid);

  return { ...session, user };
}

export async function requireRole(req, res, roles) {
  const session = await requireSession(req, res);
  if (!session) return null;
  if (!roles.includes(session.user.role)) {
    res.status(403).json({ error: 'Administrator access is required.' });
    return null;
  }
  return session;
}

export function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

function sign(value) {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is not configured');
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('base64url');
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export { COOKIE_NAME };
