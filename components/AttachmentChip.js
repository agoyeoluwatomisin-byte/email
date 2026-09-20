import MailIcon from './MailIcon';
import { formatBytes } from '../lib/mailbox';

export default function AttachmentChip({ attachment, href, downloadHref }) {
  const name = attachment.filename || attachment.name || 'Attachment';
  const type = attachment.mimeType || attachment.contentType || attachment.content_type || '';
  return (
    <div className="mail-attachment">
      <MailIcon name={type.startsWith('image/') ? 'paperclip' : 'mail'} size={15} />
      <span className="mail-attachment-name" title={name}>
        {name}
      </span>
      <span className="mail-subtle-text">{formatBytes(attachment.size)}</span>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" aria-label={`Preview ${name}`}>
          Open
        </a>
      )}
      {downloadHref && (
        <a href={downloadHref} aria-label={`Download ${name}`}>
          <MailIcon name="download" size={15} />
        </a>
      )}
    </div>
  );
}
