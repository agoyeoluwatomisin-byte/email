import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireRole } from '../../lib/auth';
import { audit } from '../../lib/audit';

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['admin']);
  if (!session) return;
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('users').select('id, email, display_name, active, role, availability, created_at').order('email');
    if (error) return res.status(500).json({ error: 'Failed to load users.' });
    return res.status(200).json({ users: data || [] });
  }
  if (req.method === 'POST') {
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 320);
    const displayName = String(req.body?.displayName || '').trim().slice(0, 160);
    const password = String(req.body?.password || '');
    const role = req.body?.role === 'admin' ? 'admin' : 'agent';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || !displayName) return res.status(400).json({ error: 'Email, display name, and a password of at least 12 characters are required.' });
    const { data, error } = await supabaseAdmin.from('users').upsert({ email, display_name: displayName, password_hash: await bcrypt.hash(password, 12), role, active: true, updated_at: new Date().toISOString() }, { onConflict: 'email' }).select('id, email, display_name, active, role').single();
    if (error) return res.status(500).json({ error: 'Failed to save user.' });
    await audit(session, 'user_upserted', 'user', data.id, { role });
    return res.status(200).json({ user: data });
  }
  if (req.method === 'PATCH') {
    const id = String(req.body?.id || '').slice(0, 80);
    const values = {};
    if (typeof req.body?.active === 'boolean') values.active = req.body.active;
    if (req.body?.role === 'admin' || req.body?.role === 'agent') values.role = req.body.role;
    if (req.body?.availability === 'available' || req.body?.availability === 'away') values.availability = req.body.availability;
    if (!Object.keys(values).length) return res.status(400).json({ error: 'A valid user update is required.' });
    const { error } = await supabaseAdmin.from('users').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to update user.' });
    if (values.active === false) await supabaseAdmin.from('user_sessions').update({ revoked_at: new Date().toISOString() }).eq('user_id', id).is('revoked_at', null);
    await audit(session, 'user_updated', 'user', id, values);
    return res.status(200).json({ success: true });
  }
  res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
  return res.status(405).json({ error: 'Method not allowed' });
}
