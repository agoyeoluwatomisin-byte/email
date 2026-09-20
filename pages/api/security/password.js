import bcrypt from 'bcryptjs';
import { requireSession } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { audit } from '../../../lib/audit';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');
  if (next.length < 12 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/\d/.test(next)) return res.status(400).json({ error: 'Password must be 12+ characters with upper, lower, and number.' });
  const { data: user } = await supabaseAdmin.from('users').select('password_hash').eq('id', session.user.id).single();
  if (!user || !(await bcrypt.compare(current, user.password_hash))) return res.status(401).json({ error: 'Current password is incorrect.' });
  const { error } = await supabaseAdmin.from('users').update({ password_hash: await bcrypt.hash(next, 12), updated_at: new Date().toISOString() }).eq('id', session.user.id);
  if (error) return res.status(500).json({ error: 'Failed to change password.' });
  await audit(session, 'password_changed');
  return res.status(200).json({ success: true });
}
