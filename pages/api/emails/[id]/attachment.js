import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  res.setHeader('Content-Type', attachment.mimeType || attachment.contentType || 'application/octet-stream');
  res.setHeader('Content-Length', content.length);
  res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${safeFilename(attachment.filename || attachment.name || 'attachment')}"`);
  return res.status(200).send(content);
}

function safeFilename(filename) {
  return String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
}