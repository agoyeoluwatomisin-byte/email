import { supabaseAdmin } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { error } = await supabaseAdmin.from('users').select('id').limit(1);
  const healthy = !error && Boolean(process.env.RESEND_API_KEY);
  return res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', supabase: !error, resend: Boolean(process.env.RESEND_API_KEY) });
}
