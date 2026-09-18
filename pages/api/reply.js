import { Resend } from 'resend';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { threadId, to, subject, message, inReplyToMessageId } = req.body || {};

  if (!threadId || !to || !subject || !message) {
    return res.status(400).json({ error: 'threadId, to, subject, and message are required' });
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
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_ADDRESS,
      to: [to],
      subject: normalizedSubject.startsWith('Re:') ? normalizedSubject : `Re: ${normalizedSubject}`,
      text: normalizedMessage,
      html: `<p>${escapeHtml(normalizedMessage).replace(/\n/g, '<br/>')}</p>`,
      headers: {
        ...(inReplyToMessageId ? { 'In-Reply-To': inReplyToMessageId, References: inReplyToMessageId } : {}),
        'List-Unsubscribe': `<mailto:${process.env.RESEND_FROM_ADDRESS}>`,
        'X-Entity-Ref-ID': `reply-${Date.now()}`,
      },
    });

    if (error) {
      return res.status(502).json({ error: error.message || 'Failed to send reply' });
    }

    await supabaseAdmin.from('emails').insert({
      thread_id: threadId,
      direction: 'outbound',
      message_id: data?.id || null,
      in_reply_to: inReplyToMessageId || null,
      from_address: process.env.RESEND_FROM_ADDRESS,
      to_address: to,
      subject: normalizedSubject,
      text_body: normalizedMessage,
      html_body: `<p>${escapeHtml(normalizedMessage).replace(/\n/g, '<br/>')}</p>`,
    });

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
