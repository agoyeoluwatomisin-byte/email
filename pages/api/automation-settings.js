import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method === 'GET') {
    const [hours, sla, mailboxes] = await Promise.all([
      supabaseAdmin.from('business_hours').select('*').order('weekday'),
      supabaseAdmin.from('sla_targets').select('*').order('label'),
      supabaseAdmin.from('mailbox_settings').select('*').order('label'),
    ]);
    return res
      .status(200)
      .json({ businessHours: hours.data || [], slaTargets: sla.data || [], mailboxSettings: mailboxes.data || [] });
  }
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const body = req.body || {};
  if (Array.isArray(body.businessHours)) {
    for (const item of body.businessHours.slice(0, 7)) {
      if (
        !Number.isInteger(Number(item.weekday)) ||
        !/^\d{2}:\d{2}$/.test(String(item.start_time)) ||
        !/^\d{2}:\d{2}$/.test(String(item.end_time))
      )
        continue;
      await supabaseAdmin.from('business_hours').upsert(
        {
          weekday: Number(item.weekday),
          start_time: item.start_time,
          end_time: item.end_time,
          timezone: String(item.timezone || 'Africa/Lagos').slice(0, 80),
          enabled: item.enabled !== false,
        },
        { onConflict: 'weekday' },
      );
    }
  }
  if (Array.isArray(body.slaTargets)) {
    for (const item of body.slaTargets.slice(0, 100)) {
      const label = String(item.label || '').slice(0, 80);
      if (!label) continue;
      await supabaseAdmin.from('sla_targets').upsert(
        {
          label,
          first_response_minutes: Math.max(1, Math.min(525600, Number(item.first_response_minutes) || 240)),
          resolution_minutes: Math.max(1, Math.min(525600, Number(item.resolution_minutes) || 1440)),
        },
        { onConflict: 'label' },
      );
    }
  }
  return res.status(200).json({ success: true });
}
