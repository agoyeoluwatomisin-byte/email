import crypto from 'crypto';

export function createCsatToken(threadId, email, expiresAt = Date.now() + 14 * 24 * 60 * 60 * 1000) {
  const value = `${threadId}.${email}.${expiresAt}`;
  const signature = crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update(value).digest('base64url');
  return Buffer.from(`${value}.${signature}`).toString('base64url');
}

export function verifyCsatToken(token) {
  try {
    const decoded = Buffer.from(String(token || ''), 'base64url').toString('utf8');
    const [threadId, email, expiresAt, signature] = decoded.split('.');
    const value = `${threadId}.${email}.${expiresAt}`;
    const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update(value).digest('base64url');
    if (!threadId || !email || !signature || Number(expiresAt) < Date.now() || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    return { threadId, email };
  } catch (error) {
    return null;
  }
}
