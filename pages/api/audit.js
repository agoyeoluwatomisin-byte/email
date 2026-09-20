import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireRole } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['admin']);
  if (!session) return;
  const { data, error } = await supabaseAdmin.from('audit_log').select('*').order('created_at', { ascending: false }).limit(1000);
  if (error) return res.status(500).json({ error: 'Failed to load audit log.' });
  return res.status(200).json({ entries: data || [] });
}
