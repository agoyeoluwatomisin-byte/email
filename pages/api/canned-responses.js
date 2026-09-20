import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requireSession(req, res))) return;

  const { data, error } = await supabaseAdmin
    .from('canned_responses')
    .select('id, title, body')
    .order('title', { ascending: true });

  if (error) {
    console.error('Failed to load canned responses:', error);
    return res.status(500).json({ error: 'Failed to load canned responses' });
  }

  return res.status(200).json({ responses: data || [] });
}
