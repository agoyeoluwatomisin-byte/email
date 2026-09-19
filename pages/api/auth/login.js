import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { createSessionToken, setSessionCookie } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

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

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
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
