import crypto from 'crypto';
import { Resend } from 'resend';
import { requireRole } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { audit } from '../../../lib/audit';

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['admin']);
  if (!session) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  const { data: user } = await supabaseAdmin.from('users').select('id, email').eq('email', email).maybeSingle();
  if (!user) return res.status(200).json({ success: true });
  const rawToken = crypto.randomBytes(32).toString('base64url');
  await supabaseAdmin.from('password_reset_tokens').delete().eq('user_id', user.id).is('used_at', null);
  const { error } = await supabaseAdmin.from('password_reset_tokens').insert({
    user_id: user.id,
    token_hash: hash(rawToken),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (error) return res.status(500).json({ error: 'Failed to create reset link.' });
  const link = `${process.env.APP_URL || `https://${req.headers.host}`}/reset-password?token=${encodeURIComponent(rawToken)}`;
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_ADDRESS)
    await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.RESEND_FROM_ADDRESS,
      to: [user.email],
      subject: 'Reset your email portal password',
      text: `Reset your password: ${link}`,
    });
  await audit(session, 'password_reset_requested', 'user', user.id);
  return res.status(200).json({ success: true });
}
function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
