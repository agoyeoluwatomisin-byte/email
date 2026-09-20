import { useState } from 'react';
import Avatar from './Avatar';
import AttachmentChip from './AttachmentChip';

export default function MessageCard({ message, isNewest, splitBody, attachmentHref }) {
  const [expanded, setExpanded] = useState(isNewest);
  const { main, quoted } = splitBody(message.text_body);
  const body = expanded ? main : `${main.slice(0, 160)}${main.length > 160 ? '…' : ''}`;
  return <article className="mail-message" data-direction={message.direction}><header className="mail-message-header"><Avatar address={message.direction === 'outbound' ? message.from_address : message.from_address} /><div className="mail-message-meta"><div className="mail-message-sender">{message.direction === 'outbound' ? 'You' : message.from_address}</div><div className="mail-message-submeta">{message.direction === 'outbound' ? `to ${message.to_address || 'recipient'}` : `to ${message.to_address || 'me'}`} · {new Date(message.received_at).toLocaleString()}</div></div><span className="mail-badge">{message.direction}</span></header><div className="mail-message-content">{body || '(no message content)'}</div>{quoted && <details className="mail-quoted"><summary>Show quoted text</summary><div>{quoted}</div></details>}{main.length > 160 && <button className="mail-text-button" type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Show less' : 'Show more'}</button>}{message.attachments?.length > 0 && <div className="mail-attachments">{message.attachments.map((attachment, index) => <AttachmentChip key={`${attachment.filename || attachment.name}-${index}`} attachment={attachment} href={attachmentHref(message.id, index)} downloadHref={attachmentHref(message.id, index, true)} />)}</div>}</article>;
}
