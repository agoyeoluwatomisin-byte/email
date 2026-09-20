import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireSession } from '../../../lib/auth';
import { attachmentPath, MAX_TOTAL_ATTACHMENT_SIZE, validateAttachment } from '../../../lib/attachments';

export const config = { api: { bodyParser: { sizeLimit: '35mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await requireSession(req, res);
  if (!session) return;

  const files = Array.isArray(req.body?.files) ? req.body.files.slice(0, 10) : [];
  if (!files.length) return res.status(400).json({ error: 'At least one attachment is required.' });
  let total = 0;
  const uploaded = [];
  const bucket = process.env.SUPABASE_ATTACHMENTS_BUCKET || 'email-attachments';

  for (const file of files) {
    const filename = String(file?.name || 'attachment').slice(0, 180);
    const contentType = String(file?.contentType || 'application/octet-stream').slice(0, 120);
    const content = String(file?.content || '');
    const buffer = Buffer.from(content, 'base64');
    total += buffer.length;
    if (total > MAX_TOTAL_ATTACHMENT_SIZE) return res.status(400).json({ error: 'Total attachments cannot exceed 25 MB.' });
    const validationError = validateAttachment(filename, contentType, buffer.length);
    if (validationError) return res.status(400).json({ error: validationError });

    const path = attachmentPath(session.user.id, filename);
    const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, { contentType, upsert: false });
    if (error) return res.status(502).json({ error: 'Failed to store attachment.' });
    const { data: row, error: rowError } = await supabaseAdmin.from('stored_attachments').insert({
      user_id: session.user.id,
      bucket,
      path,
      filename,
      content_type: contentType,
      size: buffer.length,
    }).select('id, bucket, path, filename, content_type, size').single();
    if (rowError) return res.status(500).json({ error: 'Failed to record attachment.' });
    uploaded.push(row);
  }

  return res.status(200).json({ attachments: uploaded });
}
