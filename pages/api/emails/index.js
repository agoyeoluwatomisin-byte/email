import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data, error } = await supabaseAdmin
    .from('emails')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(300);

  if (error) {
    return res.status(500).json({ error: 'Failed to load emails' });
  }
  return res.status(200).json({ emails: data });
}
