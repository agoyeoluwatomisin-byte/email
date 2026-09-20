import { zipSync, strToU8 } from 'fflate';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireRole } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['admin']);
  if (!session) return;
  const format = String(req.query?.format || 'threads');
  const { data: emails, error } = await supabaseAdmin.from('emails').select('*').is('deleted_at', null).order('received_at', { ascending: true }).limit(10000);
  if (error) return res.status(500).json({ error: 'Failed to export messages.' });
  if (format === 'contacts') {
    const { data: contacts } = await supabaseAdmin.from('contacts').select('*').order('email').limit(10000);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    return res.status(200).send(toCsv(contacts || []));
  }
  const rows = (emails || []).map((email) => ({ thread_id: email.thread_id, direction: email.direction, from: email.from_address, to: email.to_address, subject: email.subject, received_at: email.received_at, body: email.text_body }));
  const csv = toCsv(rows);
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="threads.csv"');
    return res.status(200).send(csv);
  }
  const files = { 'threads.csv': strToU8(csv) };
  for (const email of emails || []) files[`messages/${email.id}.eml`] = strToU8(`From: ${email.from_address}\nTo: ${email.to_address}\nSubject: ${email.subject || ''}\nDate: ${email.received_at}\nMessage-ID: ${email.message_id || ''}\n\n${email.text_body || ''}\n`);
  const archive = zipSync(files);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="email-export.zip"');
  return res.status(200).send(Buffer.from(archive));
}

function toCsv(rows) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  return [columns.join(','), ...rows.map((row) => columns.map((column) => `"${String(row[column] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
}
