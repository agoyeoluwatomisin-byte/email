import { clearSessionCookie, getSessionFromRequest } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = getSessionFromRequest(req);
  if (session?.sid) await supabaseAdmin.from('user_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', session.sid);

  clearSessionCookie(res);
  return res.status(200).json({ success: true });
}
