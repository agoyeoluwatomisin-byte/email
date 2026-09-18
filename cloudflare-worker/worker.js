import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    try {
      const buffer = await streamToArrayBuffer(message.raw, message.rawSize);
      const parsed = await PostalMime.parse(buffer);

      const payload = {
        messageId: parsed.messageId || null,
        inReplyTo: parsed.inReplyTo || null,
        references: parsed.references || null,
        from: message.from,
        to: message.to,
        subject: parsed.subject || '(no subject)',
        text: parsed.text || '',
        html: parsed.html || '',
        attachments: (parsed.attachments || []).map((attachment) => ({
          filename: attachment.filename || 'attachment',
          mimeType: attachment.mimeType || 'application/octet-stream',
          size: attachment.size || 0,
          content: toBase64(attachment.content),
        })),
      };

      const res = await fetch(env.inbound_webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-inbound-secret': env.inbound_shared_secret,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error('Webhook rejected inbound email:', res.status, await res.text());
      }
    } catch (err) {
      console.error('Failed to process inbound email:', err);
      // Don't reject the message - that would bounce it back to the sender.
    }
  },
};

async function streamToArrayBuffer(stream, size) {
  const reader = stream.getReader();
  const buffer = new Uint8Array(size);
  let offset = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer.set(value, offset);
    offset += value.length;
  }
  return buffer.buffer;
}

function toBase64(value) {
  if (!value) return '';
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}
