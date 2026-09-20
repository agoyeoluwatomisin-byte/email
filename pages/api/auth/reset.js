import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password))
    return res.status(400).json({ error: 'Password must be 12+ characters with upper, lower, and number.' });
  const { data: reset } = await supabaseAdmin
    .from('password_reset_tokens')
    .select('id, user_id')
    .eq('token_hash', crypto.createHash('sha256').update(token).digest('hex'))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!reset) return res.status(400).json({ error: 'Reset link is invalid or expired.' });
  const { error } = await supabaseAdmin
    .from('users')
    .update({ password_hash: await bcrypt.hash(password, 12), updated_at: new Date().toISOString() })
    .eq('id', reset.user_id);
  if (error) return res.status(500).json({ error: 'Failed to reset password.' });
  await supabaseAdmin.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', reset.id);
  await supabaseAdmin
    .from('user_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', reset.user_id)
    .is('revoked_at', null);
  return res.status(200).json({ success: true });
}
