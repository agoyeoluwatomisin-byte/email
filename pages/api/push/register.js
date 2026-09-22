import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireSession } from '../../../lib/auth';

const ALLOWED_PLATFORMS = ['android', 'ios', 'web'];

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  if (req.method === 'POST') {
    const token = String(req.body?.token || '').trim();
    const platform = ALLOWED_PLATFORMS.includes(req.body?.platform) ? req.body.platform : 'android';

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const { error } = await supabaseAdmin.from('device_tokens').upsert(
      {
        user_id: session.user.id,
        token,
        platform,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );

    if (error) {
      console.error('Failed to save device token:', error);
      return res.status(500).json({ error: 'Failed to save device token' });
    }

    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token is required' });

    const { error } = await supabaseAdmin
      .from('device_tokens')
      .delete()
      .eq('user_id', session.user.id)
      .eq('token', token);

    if (error) {
      console.error('Failed to remove device token:', error);
      return res.status(500).json({ error: 'Failed to remove device token' });
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['POST', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}