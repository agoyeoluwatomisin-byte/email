import { randomUUID } from 'crypto';
import crypto from 'crypto';
import { Resend } from 'resend';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { firstMatchingRule } from '../../lib/rules';
import { sendOutboundEmail } from '../../lib/sendOutbound';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-inbound-secret'];
  const expectedSecret = process.env.INBOUND_SHARED_SECRET || '';
  const providedSecret = Buffer.from(String(secret || ''));
  const expectedSecretBuffer = Buffer.from(expectedSecret);
  if (
    !secret ||
    providedSecret.length !== expectedSecretBuffer.length ||
    !crypto.timingSafeEqual(providedSecret, expectedSecretBuffer)
  ) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    messageId,
    inReplyTo,
    references,
    from,
    to,
    subject,
    text,
    html,
    attachments,
    xWidget,
    authenticationResults,
    autoSubmitted,
    precedence,
  } = req.body || {};

  if (xWidget) return res.status(200).json({ success: true, ignored: true });

  if (!from || !to) {
    return res.status(400).json({ error: 'from and to are required' });
  }

  if (messageId) {
    const { data: existing } = await supabaseAdmin
      .from('emails')
      .select('id')
      .eq('message_id', messageId)
      .eq('direction', 'inbound')
      .maybeSingle();
    if (existing) return res.status(200).json({ success: true, duplicate: true });
  }

  const label = deriveInboundLabel(to);
  const senderEmail =
    String(from)
      .toLowerCase()
      .match(/<([^>]+)>/)?.[1] || String(from).toLowerCase().trim();
  const senderDomain = deriveSenderDomain(from);
  const { data: senderEntries } = await supabaseAdmin.from('sender_lists').select('value, list_type');
  const allowedSender = (senderEntries || []).some(
    (entry) => entry.list_type === 'allow' && (entry.value === senderEmail || entry.value === senderDomain),
  );
  const blockedSender =
    !allowedSender &&
    (senderEntries || []).some(
      (entry) => entry.list_type === 'block' && (entry.value === senderEmail || entry.value === senderDomain),
    );
  const { data: rules } = await supabaseAdmin.from('rules').select('*').eq('enabled', true).order('order_index');
  const matchedRule = firstMatchingRule(
    { from, to, subject, hasAttachment: Array.isArray(attachments) && attachments.length > 0 },
    rules || [],
  );
  const { data: mailboxSetting } = await supabaseAdmin
    .from('mailbox_settings')
    .select('round_robin_enabled, next_user_id')
    .eq('label', label)
    .maybeSingle();
  let assignedUser = matchedRule?.actions?.assign_to || null;
  if (!assignedUser && mailboxSetting?.round_robin_enabled) {
    const { data: availableUsers } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('active', true)
      .eq('availability', 'available')
      .order('email');
    if (availableUsers?.length) {
      const currentIndex = availableUsers.findIndex((user) => user.id === mailboxSetting.next_user_id);
      const next = availableUsers[(currentIndex + 1) % availableUsers.length];
      assignedUser = next.email;
      await supabaseAdmin.from('mailbox_settings').update({ next_user_id: next.id }).eq('label', label);
    }
  }

  // Thread the message: if it's a reply to something we already have,
  // reuse that thread_id. Otherwise start a new thread.
  let threadId = randomUUID();
  let matchedHeader = false;

  const referenceIds = [
    ...new Set(
      [...(Array.isArray(references) ? references : String(references || '').split(/\s+/)), inReplyTo].filter(Boolean),
    ),
  ];
  if (referenceIds.length) {
    const { data: parent } = await supabaseAdmin
      .from('emails')
      .select('thread_id')
      .in('message_id', referenceIds)
      .limit(1)
      .maybeSingle();

    if (parent) {
      threadId = parent.thread_id;
      matchedHeader = true;
    }
  }

  if (!matchedHeader) {
    const normalizedSubject = normalizeSubject(subject);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: candidates } = await supabaseAdmin
      .from('emails')
      .select('thread_id, subject, from_address')
      .eq('direction', 'inbound')
      .eq('from_address', from)
      .gte('received_at', cutoff)
      .order('received_at', { ascending: false })
      .limit(50);
    const subjectMatch = (candidates || []).find(
      (candidate) => normalizeSubject(candidate.subject) === normalizedSubject,
    );
    if (subjectMatch) threadId = subjectMatch.thread_id;
  }

  const { data: priorInbound } = await supabaseAdmin
    .from('emails')
    .select('id')
    .eq('thread_id', threadId)
    .eq('direction', 'inbound')
    .limit(1);
  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .upsert({ email: senderEmail, updated_at: new Date().toISOString() }, { onConflict: 'email' })
    .select('id')
    .single();

  await supabaseAdmin
    .from('threads')
    .upsert({ thread_id: threadId }, { onConflict: 'thread_id', ignoreDuplicates: true });
  await supabaseAdmin
    .from('threads')
    .update({ status: 'new', updated_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('status', 'closed');

  const storedAttachments = await storeInboundAttachments(threadId, attachments);
  if (storedAttachments.error) {
    console.error('Failed to store inbound attachments:', storedAttachments.error);
    return res.status(502).json({ error: 'Failed to store inbound attachments' });
  }

  const { error } = await supabaseAdmin.from('emails').insert({
    thread_id: threadId,
    direction: 'inbound',
    message_id: messageId,
    in_reply_to: inReplyTo,
    from_address: from,
    sender_domain: senderDomain,
    to_address: to,
    subject,
    text_body: text,
    html_body: html,
    folder: blockedSender || matchedRule?.actions?.folder === 'spam' ? 'spam' : matchedRule?.actions?.folder || 'inbox',
    label: matchedRule?.actions?.label || label,
    read: Boolean(matchedRule?.actions?.mark_read),
    starred: Boolean(matchedRule?.actions?.star),
    authentication_results: String(authenticationResults || '').slice(0, 2000) || null,
    contact_id: contact?.id || null,
    attachments: storedAttachments.files,
  });

  if (error) {
    if (error.code === '23505') return res.status(200).json({ success: true, duplicate: true });
    console.error('Failed to store inbound email:', error);
    return res.status(500).json({ error: 'Failed to store email' });
  }

  await notifyInboundEmail({ from, to, subject, text, threadId });
  await notifyOutboundWebhook({ from, to, subject, threadId });

  if (assignedUser)
    await supabaseAdmin
      .from('threads')
      .update({ claimed_by: String(assignedUser).slice(0, 320), updated_at: new Date().toISOString() })
      .eq('thread_id', threadId);
  await maybeAutoReply({
    from,
    to,
    subject,
    text,
    threadId,
    autoSubmitted,
    precedence,
    isFirstInbound: !(priorInbound || []).length,
  });

  return res.status(200).json({ success: true });
}

async function notifyOutboundWebhook(payload) {
  if (!process.env.OUTBOUND_WEBHOOK_URL) return;
  try {
    const body = JSON.stringify({ event: 'inbound.message', ...payload });
    const signature = crypto
      .createHmac('sha256', process.env.OUTBOUND_WEBHOOK_SECRET || '')
      .update(body)
      .digest('hex');
    await fetch(process.env.OUTBOUND_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agosoft-Signature': signature },
      body,
    });
  } catch (error) {
    console.error('Outbound webhook failed:', error);
  }
}

async function maybeAutoReply({ from, to, subject, text, threadId, autoSubmitted, precedence, isFirstInbound }) {
  if (!isFirstInbound || /no[-_ ]?reply/i.test(from) || autoSubmitted || /bulk|list/i.test(String(precedence || '')))
    return;
  const { data: setting } = await supabaseAdmin
    .from('mailbox_settings')
    .select('auto_reply_enabled, business_hours_reply, out_of_hours_reply')
    .eq('label', deriveInboundLabel(to))
    .maybeSingle();
  if (!setting?.auto_reply_enabled) return;
  const { data: recent } = await supabaseAdmin
    .from('emails')
    .select('id')
    .eq('direction', 'outbound')
    .eq('to_address', from)
    .gte('received_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1);
  if (recent?.length) return;
  const message =
    setting.business_hours_reply ||
    'Thanks for contacting us. We have received your message and will be in touch soon.';
  try {
    await sendOutboundEmail({
      threadId,
      to: [from],
      subject: `Re: ${String(subject || '(no subject)').slice(0, 900)}`,
      text: message,
      html: `<p>${escapeHtml(message)}</p>`,
    });
  } catch (error) {
    console.error('Auto-reply failed:', error);
  }
}

async function storeInboundAttachments(threadId, attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return { files: [] };
  }

  const files = [];
  const bucket = process.env.SUPABASE_ATTACHMENTS_BUCKET || 'email-attachments';

  for (const attachment of attachments.slice(0, 10)) {
    if (!attachment?.content) continue;

    const filename = safeFilename(attachment.filename || attachment.name || 'attachment');
    const path = `${threadId}/${randomUUID()}-${filename}`;
    const content = Buffer.from(attachment.content, 'base64');
    const { error } = await supabaseAdmin.storage.from(bucket).upload(path, content, {
      contentType: attachment.mimeType || attachment.contentType || 'application/octet-stream',
      upsert: false,
    });

    if (error) return { files: [], error };

    files.push({
      path,
      bucket,
      filename,
      mimeType: attachment.mimeType || attachment.contentType || 'application/octet-stream',
      size: attachment.size || content.length,
    });
  }

  return { files };
}

function safeFilename(filename) {
  return String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function notifyInboundEmail({ from, to, subject, text, threadId }) {
  const recipient = process.env.INBOUND_NOTIFICATION_EMAIL;
  const sender = process.env.RESEND_FROM_ADDRESS;

  if (!recipient || !sender || !process.env.RESEND_API_KEY) {
    return;
  }

  try {
    const preview =
      String(text || '')
        .trim()
        .slice(0, 1000) || '(no message text)';
    const safeSubject = String(subject || '(no subject)').trim();
    const result = await resend.emails.send({
      from: sender,
      to: [recipient],
      subject: `New inbound email: ${safeSubject}`,
      text: `New email received\n\nFrom: ${from}\nTo: ${to}\nSubject: ${safeSubject}\nThread: ${threadId}\n\n${preview}`,
      html: `<p><strong>New email received</strong></p><p><strong>From:</strong> ${escapeHtml(from)}<br/><strong>To:</strong> ${escapeHtml(to)}<br/><strong>Subject:</strong> ${escapeHtml(safeSubject)}<br/><strong>Thread:</strong> ${escapeHtml(threadId)}</p><p>${escapeHtml(preview).replace(/\n/g, '<br/>')}</p>`,
    });

    if (result.error) {
      console.error('Inbound notification failed:', result.error);
    }
  } catch (error) {
    console.error('Inbound notification error:', error);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function deriveInboundLabel(value) {
  const address =
    String(value)
      .toLowerCase()
      .match(/<([^>]+)>/)?.[1] || String(value).split(/[;,]/)[0];
  const localPart = address
    .trim()
    .replace(/^mailto:/, '')
    .split('@')[0]
    .replace(/[^a-z0-9._+-]/g, '');

  if (localPart.includes('sales')) return 'sales';
  if (localPart.includes('support')) return 'support';
  if (localPart.includes('billing') || localPart.includes('invoice')) return 'billing';
  return localPart || 'other';
}

function deriveSenderDomain(value) {
  const address =
    String(value)
      .toLowerCase()
      .match(/<([^>]+)>/)?.[1] || String(value).split(/[;,]/)[0];
  return (
    address
      .trim()
      .replace(/^mailto:/, '')
      .split('@')[1]
      ?.replace(/[^a-z0-9.-]/g, '') || null
  );
}

function normalizeSubject(value) {
  return String(value || '(no subject)')
    .replace(/^(\s*(re|fw|fwd)\s*:\s*)+/i, '')
    .trim()
    .toLowerCase();
}
