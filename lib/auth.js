import crypto from 'crypto';

const COOKIE_NAME = 'email_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function createSessionToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
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
