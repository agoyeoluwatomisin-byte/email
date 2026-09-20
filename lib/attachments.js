import { randomUUID } from 'crypto';
import { supabaseAdmin } from './supabaseAdmin';

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const blockedExtensions = new Set(['.exe', '.js', '.mjs', '.cjs', '.bat', '.cmd', '.com', '.scr', '.sh', '.ps1', '.jar', '.msi', '.dll']);

export function validateAttachment(filename, contentType, size) {
  const cleanName = String(filename || 'attachment').slice(0, 180);
  const extension = cleanName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
  if (!Number.isInteger(size) || size < 1 || size > MAX_ATTACHMENT_SIZE) return 'Each attachment must be between 1 byte and 10 MB.';
  if (blockedExtensions.has(extension)) return 'This attachment type is blocked for safety.';
  if (!String(contentType || '').slice(0, 120)) return 'Attachment content type is required.';
  return null;
}

export async function loadAttachmentContent(attachment) {
  if (!attachment?.path) return null;
  const bucket = attachment.bucket || process.env.SUPABASE_ATTACHMENTS_BUCKET || 'email-attachments';
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(attachment.path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export function attachmentPath(userId, filename) {
  const safeName = String(filename || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${userId}/${randomUUID()}-${safeName}`;
}
