import { supabaseAdmin } from './supabaseAdmin';

export async function audit(session, action, targetType, targetId, details = {}) {
  await supabaseAdmin.from('audit_log').insert({ actor_id: session?.user?.id || null, actor_email: session?.user?.email || null, action: String(action).slice(0, 120), target_type: targetType ? String(targetType).slice(0, 80) : null, target_id: targetId ? String(targetId).slice(0, 160) : null, details });
}
