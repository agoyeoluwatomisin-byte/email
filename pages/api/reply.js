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

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_ADDRESS,
      to: [to],
      subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
      html: `<p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>`,
      ...(inReplyToMessageId
        ? { headers: { 'In-Reply-To': inReplyToMessageId, References: inReplyToMessageId } }
        : {}),
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
      subject,
      text_body: message,
      html_body: `<p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>`,
    });

    return res.status(200).json({ success: true, id: data?.id });
  } catch (err) {
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
