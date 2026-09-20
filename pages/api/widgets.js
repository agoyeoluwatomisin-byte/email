import crypto from 'crypto';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireRole } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['admin']);
  if (!session) return;
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('widgets').select('*').order('name');
    if (error) return res.status(500).json({ error: 'Failed to load widgets.' });
    return res.status(200).json({ widgets: data || [] });
  }
  if (req.method === 'POST' || req.method === 'PATCH') {
    const body = req.body || {};
    const values = {
      name: String(body.name || '').slice(0, 120),
      widget_key: String(body.widgetKey || crypto.randomBytes(18).toString('hex')).slice(0, 100),
      allowed_origins: Array.isArray(body.allowedOrigins)
        ? body.allowedOrigins.slice(0, 20).map((origin) => String(origin).slice(0, 300))
        : [],
      destination_label: String(body.destinationLabel || 'website').slice(0, 80),
      destination_email: String(body.destinationEmail || '').slice(0, 320),
      title: String(body.title || 'Contact us').slice(0, 160),
      accent_color: /^#[0-9a-f]{6}$/i.test(body.accentColor) ? body.accentColor : '#2f8fca',
      custom_fields: Array.isArray(body.customFields) ? body.customFields.slice(0, 20) : [],
      enabled: body.enabled !== false,
      updated_at: new Date().toISOString(),
    };
    if (!values.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.destination_email))
      return res.status(400).json({ error: 'Name and valid destination email are required.' });
    const query =
      req.method === 'POST'
        ? supabaseAdmin.from('widgets').insert(values).select().single()
        : supabaseAdmin
            .from('widgets')
            .update(values)
            .eq('id', String(body.id || '').slice(0, 80))
            .select()
            .single();
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Failed to save widget.' });
    return res.status(200).json({ widget: data });
  }
  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin
      .from('widgets')
      .delete()
      .eq('id', String(req.query?.id || '').slice(0, 80));
    if (error) return res.status(500).json({ error: 'Failed to delete widget.' });
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
