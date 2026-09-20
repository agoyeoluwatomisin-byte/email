import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';
import { htmlToText, sanitizeEmailHtml } from '../../lib/emailContent';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('user_signatures')
      .select('signature_html, signature_text, updated_at')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'Failed to load signature.' });
    return res.status(200).json({ signature: data || { signature_html: '', signature_text: '' } });
  }

  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signatureHtml = sanitizeEmailHtml(String(req.body?.signatureHtml || '').slice(0, 10000));
  const signatureText = String(req.body?.signatureText || htmlToText(signatureHtml)).slice(0, 5000);
  const { data, error } = await supabaseAdmin
    .from('user_signatures')
    .upsert(
      {
        user_id: session.user.id,
        signature_html: signatureHtml,
        signature_text: signatureText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single();
  if (error) return res.status(500).json({ error: 'Failed to save signature.' });
  return res.status(200).json({ signature: data });
}
