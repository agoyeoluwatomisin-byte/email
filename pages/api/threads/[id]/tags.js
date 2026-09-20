import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireSession } from '../../../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  const threadId = String(req.query?.id || '').slice(0, 80);
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('thread_tags').select('tag_id, tags(id, name, color)').eq('thread_id', threadId);
    if (error) return res.status(500).json({ error: 'Failed to load thread tags.' });
    return res.status(200).json({ tags: (data || []).map((item) => item.tags).filter(Boolean) });
  }
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const tagIds = Array.isArray(req.body?.tagIds) ? req.body.tagIds.map((id) => String(id).slice(0, 80)).slice(0, 30) : [];
  const { error: deleteError } = await supabaseAdmin.from('thread_tags').delete().eq('thread_id', threadId);
  if (deleteError) return res.status(500).json({ error: 'Failed to update thread tags.' });
  if (tagIds.length) {
    const { error } = await supabaseAdmin.from('thread_tags').insert(tagIds.map((tag_id) => ({ thread_id: threadId, tag_id })));
    if (error) return res.status(500).json({ error: 'Failed to update thread tags.' });
  }
  return res.status(200).json({ success: true, tagIds });
}
