import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('availability, away_message')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'Failed to load availability.' });
    return res.status(200).json({
      availability: data?.availability || 'available',
      awayMessage: data?.away_message || '',
    });
  }

  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const availability = req.body?.availability === 'away' ? 'away' : 'available';
  const awayMessage = String(req.body?.awayMessage || '').slice(0, 2000);

  const { error } = await supabaseAdmin
    .from('users')
    .update({ availability, away_message: awayMessage, updated_at: new Date().toISOString() })
    .eq('id', session.user.id);
  if (error) return res.status(500).json({ error: 'Failed to save availability.' });
  return res.status(200).json({ success: true, availability, awayMessage });
}