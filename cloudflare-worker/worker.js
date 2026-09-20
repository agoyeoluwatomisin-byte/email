import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    try {
      if (!env.INBOUND_WEBHOOK_URL || !env.INBOUND_SHARED_SECRET) {
        console.error('Missing INBOUND_WEBHOOK_URL or INBOUND_SHARED_SECRET worker secret.');
        return;
      }
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
        authenticationResults: getHeader(parsed.headers, 'authentication-results'),
        autoSubmitted: getHeader(parsed.headers, 'auto-submitted'),
        precedence: getHeader(parsed.headers, 'precedence'),
        xWidget: hasWidgetHeader(parsed.headers),
        attachments: (parsed.attachments || []).map((attachment) => {
          const size = attachment.size || 0;
          if (size > 20 * 1024 * 1024) {
            return { filename: attachment.filename || 'attachment', mimeType: attachment.mimeType || 'application/octet-stream', size, skipped: true, reason: 'over_20mb' };
          }
          return { filename: attachment.filename || 'attachment', mimeType: attachment.mimeType || 'application/octet-stream', size, content: toBase64(attachment.content) };
        }),
      };

      const delivered = await deliverWithRetry(env.INBOUND_WEBHOOK_URL, env.INBOUND_SHARED_SECRET, payload);
      if (!delivered) {
        console.error('Inbound webhook failed after 3 attempts.');
        const fallbackAddress = env.fallback_forward_address || env.FALLBACK_FORWARD_ADDRESS;
        if (fallbackAddress) await message.forward(fallbackAddress);
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

async function deliverWithRetry(url, secret, payload) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-inbound-secret': secret },
        body: JSON.stringify(payload),
      });
      if (res.ok) return true;
      console.error(`Inbound webhook attempt ${attempt} failed:`, res.status, await res.text());
    } catch (error) {
      console.error(`Inbound webhook attempt ${attempt} failed:`, error);
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }
  return false;
}

function toBase64(value) {
  if (!value) return '';
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  let binary = '';
  for (let index = 0; index < bytes.length; index += 32 * 1024) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + 32 * 1024));
  }
  return btoa(binary);
}

function hasWidgetHeader(headers) {
  return (headers || []).some((header) => String(header.key || header.name || '').toLowerCase() === 'x-agosoft-widget' && String(header.value || '').trim() === '1');
}

function getHeader(headers, name) {
  return (headers || []).find((header) => String(header.key || header.name || '').toLowerCase() === name)?.value || null;
}