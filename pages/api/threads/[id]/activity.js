import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getSessionFromRequest } from '../../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!getSessionFromRequest(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const threadId = String(req.query?.id || '');
  if (!threadId) return res.status(400).json({ error: 'Thread id is required' });

  const { data, error } = await supabaseAdmin
    .from('thread_activity')
    .select('id, thread_id, actor_email, activity_type, message_id, details, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load thread activity:', error);
    return res.status(500).json({ error: 'Failed to load thread activity' });
  }

  return res.status(200).json({ activity: data || [] });
}
