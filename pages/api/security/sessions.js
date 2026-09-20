import { requireSession } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('user_sessions')
      .select('id, user_agent, ip_address, created_at, last_seen_at, expires_at')
      .eq('user_id', session.user.id)
      .is('revoked_at', null)
      .order('last_seen_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Failed to load sessions.' });
    return res.status(200).json({ sessions: data || [] });
  }
  if (req.method === 'DELETE') {
    const id = String(req.query?.id || '').slice(0, 80);
    const { error } = await supabaseAdmin
      .from('user_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', session.user.id);
    if (error) return res.status(500).json({ error: 'Failed to revoke session.' });
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
