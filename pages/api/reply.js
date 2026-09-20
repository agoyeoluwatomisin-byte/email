import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';
import { sendOutboundEmail } from '../../lib/sendOutbound';
import { sanitizeEmailHtml } from '../../lib/emailContent';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { threadId, to, cc, bcc, from, subject, message, html, attachments, inReplyToMessageId, references, action } =
    req.body || {};
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
    const { data: signature } = await supabaseAdmin
      .from('user_signatures')
      .select('signature_html, signature_text')
      .eq('user_id', session.user.id)
      .maybeSingle();
    const textBody = `${normalizedMessage}${action === 'forward' ? '' : signature?.signature_text ? `\n\n${signature.signature_text}` : ''}`;
    const htmlBody = sanitizeEmailHtml(
      `${html || `<p>${escapeHtml(normalizedMessage).replace(/\n/g, '<br/>')}</p>`}${action === 'forward' ? '' : signature?.signature_html || ''}`,
    );
    const result = await sendOutboundEmail({
      userId: session.user.id,
      threadId,
      to: Array.isArray(to)
        ? to
        : String(to)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
      cc: Array.isArray(cc)
        ? cc
        : String(cc || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
      bcc: Array.isArray(bcc)
        ? bcc
        : String(bcc || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
      replyTo: fromAddress,
      subject:
        normalizedSubject.startsWith('Re:') || action === 'forward' ? normalizedSubject : `Re: ${normalizedSubject}`,
      text: textBody,
      html: htmlBody,
      attachments,
      inReplyTo: inReplyToMessageId,
      references: references || inReplyToMessageId,
    });

    const { error: activityError } = await supabaseAdmin.from('thread_activity').insert({
      thread_id: threadId,
      actor_email: session.email,
      activity_type: 'reply_sent',
      message_id: result.messageId,
      details: { to, subject: normalizedSubject },
    });

    if (activityError) {
      console.error('Reply sent but activity could not be recorded:', activityError);
    }

    return res.status(200).json({ success: true, id: result.id, messageId: result.messageId });
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
