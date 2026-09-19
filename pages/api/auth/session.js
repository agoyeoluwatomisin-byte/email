import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getSessionFromRequest } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!session) return res.status(401).json({ authenticated: false });

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, display_name, active')
    .eq('id', session.id)
    .eq('active', true)
    .maybeSingle();

  if (error || !user) return res.status(401).json({ authenticated: false });
  return res.status(200).json({ authenticated: true, user: { id: user.id, email: user.email, displayName: user.display_name } });
}
