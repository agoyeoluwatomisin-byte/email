import { Resend } from 'resend';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { threadId, to, from, subject, message, inReplyToMessageId } = req.body || {};
  const session = await requireSession(req, res);
  if (!session) return;

  if (!threadId || !to || !subject || !message) {
    return res.status(400).json({ error: 'threadId, to, subject, and message are required' });
  }

  const claimedBy = session.email;
  if (!claimedBy) {
    return res.status(403).json({ error: 'Claim this thread before replying.' });
  }

  const { data: threadOwner, error: ownerError } = await supabaseAdmin
    .from('threads')
    .select('claimed_by')
    .eq('thread_id', threadId)
    .maybeSingle();

  if (ownerError) return res.status(500).json({ error: 'Unable to verify thread ownership.' });
  if (threadOwner?.claimed_by !== claimedBy) {
    return res.status(409).json({ error: 'This thread is claimed by another staff member.' });
  }

  const defaultFrom = process.env.RESEND_FROM_ADDRESS;
  if (!defaultFrom) {
    return res.status(500).json({ error: 'RESEND_FROM_ADDRESS is not configured.' });
  }

  // Resolve which address to reply FROM. If the caller supplied one (e.g. the
  // address the original email was sent to), use it - but only if it's on
  // our verified sending domain. Otherwise fall back to the default address.
  const defaultFromEmail = (defaultFrom.match(/<(.+)>/)?.[1] || defaultFrom).trim();
  const verifiedDomain = defaultFromEmail.split('@')[1]?.toLowerCase();

  let fromAddress = defaultFrom;
  if (from) {
    const requestedEmail = String(from).trim().toLowerCase();
    const requestedDomain = requestedEmail.split('@')[1];
    if (requestedDomain && verifiedDomain && requestedDomain === verifiedDomain) {
      fromAddress = requestedEmail;
    }
    // If it doesn't match our verified domain, we silently keep defaultFrom -
    // Resend would reject the send anyway for an unverified domain.
  }

  const normalizedMessage = String(message).trim();
  const normalizedSubject = String(subject).trim();
  const spamSignals = /(viagra|cialis|bitcoin|crypto|free money|click here|earn.*\$|limited time offer|urgent cash)/i;

  if (spamSignals.test(normalizedSubject) || spamSignals.test(normalizedMessage)) {
    return res.status(400).json({ error: 'Reply looks like spam and was blocked.' });
  }

  const upperRatio = (normalizedMessage.match(/[A-Z]/g) || []).length / Math.max(normalizedMessage.length, 1);
  if (upperRatio > 0.35) {
    return res.status(400).json({ error: 'Avoid excessive uppercase text in replies.' });
  }

  try {
    const messageId = `<${randomUUID()}@${defaultFromEmail.split('@')[1] || 'localhost'}>`;
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: normalizedSubject.startsWith('Re:') ? normalizedSubject : `Re: ${normalizedSubject}`,
      text: normalizedMessage,
      html: `<p>${escapeHtml(normalizedMessage).replace(/\n/g, '<br/>')}</p>`,
      headers: {
        ...(inReplyToMessageId ? { 'In-Reply-To': inReplyToMessageId, References: inReplyToMessageId } : {}),
        'Message-ID': messageId,
        'X-Entity-Ref-ID': `reply-${Date.now()}`,
      },
    });

    if (error) {
      return res.status(502).json({ error: error.message || 'Failed to send reply' });
    }

    await supabaseAdmin.from('threads').upsert({ thread_id: threadId }, { onConflict: 'thread_id', ignoreDuplicates: true });

    const { error: storeError } = await supabaseAdmin.from('emails').insert({
      thread_id: threadId,
      direction: 'outbound',
      message_id: messageId,
      in_reply_to: inReplyToMessageId || null,
      from_address: fromAddress,
      to_address: to,
      subject: normalizedSubject,
      text_body: normalizedMessage,
      html_body: `<p>${escapeHtml(normalizedMessage).replace(/\n/g, '<br/>')}</p>`,
      folder: 'sent',
    });

    if (storeError) {
      console.error('Reply sent but could not be stored:', storeError);
      return res.status(502).json({ error: 'Reply sent, but could not be stored.' });
    }

    const { error: activityError } = await supabaseAdmin.from('thread_activity').insert({
      thread_id: threadId,
      actor_email: session.email,
      activity_type: 'reply_sent',
      message_id: messageId,
      details: { to, subject: normalizedSubject },
    });

    if (activityError) {
      console.error('Reply sent but activity could not be recorded:', activityError);
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (err) {
    console.error('reply error:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}