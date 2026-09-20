import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireSession } from '../../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requireSession(req, res))) return;

  const { id, index = '0' } = req.query || {};
  const attachmentIndex = Number(index);
  if (!id || !Number.isInteger(attachmentIndex) || attachmentIndex < 0) {
    return res.status(400).json({ error: 'A valid message and attachment index are required' });
  }

  const { data: email, error } = await supabaseAdmin
    .from('emails')
    .select('attachments')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Failed to load attachment:', error);
    return res.status(500).json({ error: 'Failed to load attachment' });
  }

  const attachment = Array.isArray(email?.attachments) ? email.attachments[attachmentIndex] : null;
  if (!attachment) {
    return res.status(404).json({ error: 'Attachment not found' });
  }

  let content;
  if (attachment.path) {
    const bucket = attachment.bucket || process.env.SUPABASE_ATTACHMENTS_BUCKET || 'email-attachments';
    const { data: file, error: downloadError } = await supabaseAdmin.storage.from(bucket).download(attachment.path);

    if (downloadError || !file) {
      console.error('Failed to download stored attachment:', downloadError);
      return res.status(404).json({ error: 'Stored attachment is unavailable' });
    }

    content = Buffer.from(await file.arrayBuffer());
  } else if (attachment.content) {
    content = Buffer.from(attachment.content, 'base64');
  } else {
    return res.status(404).json({ error: 'Attachment content is unavailable' });
  }

  const contentType = String(attachment.mimeType || attachment.contentType || 'application/octet-stream').toLowerCase();
  const inlineTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']);
  const disposition = req.query.download === '1' || !inlineTypes.has(contentType) ? 'attachment' : 'inline';
  const filename = String(attachment.filename || attachment.name || 'attachment').replace(/[\r\n]/g, '_');
  const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape);

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', content.length);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', 'sandbox');
  res.setHeader('Content-Disposition', `${disposition}; filename="${safeFilename(filename)}"; filename*=UTF-8''${encodedFilename}`);
  return res.status(200).send(content);
}

function safeFilename(filename) {
  return String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
}