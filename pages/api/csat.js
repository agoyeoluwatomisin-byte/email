import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { verifyCsatToken } from '../../lib/csat';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const verified = verifyCsatToken(req.body?.token);
    const rating = Number(req.body?.rating);
    if (!verified || !Number.isInteger(rating) || rating < 1 || rating > 5)
      return res.status(400).json({ error: 'Invalid survey response.' });
    const { error } = await supabaseAdmin.from('csat_responses').upsert(
      {
        thread_id: verified.threadId,
        contact_email: verified.email,
        rating,
        comment: String(req.body?.comment || '').slice(0, 2000),
      },
      { onConflict: 'thread_id,contact_email' },
    );
    if (error) return res.status(500).json({ error: 'Failed to save survey response.' });
    return res.status(200).json({ success: true });
  }
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { data, error } = await supabaseAdmin
    .from('csat_responses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return res.status(500).json({ error: 'Failed to load survey responses.' });
  return res.status(200).json({ responses: data || [] });
}
