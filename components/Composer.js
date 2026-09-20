import RichEditor from './RichEditor';
import MailIcon from './MailIcon';

export default function Composer({ open, onOpen, onSubmit, sending, error, cannedResponses, onCannedResponse, draft, onDraftChange }) {
  const value = draft || { text: '', html: '', cc: '', bcc: '' };
  const update = (changes) => onDraftChange({ ...value, ...changes });
  if (!open) return <button className="mail-composer-collapsed" type="button" onClick={onOpen}><span>Reply…</span><MailIcon name="send" size={16} /></button>;
  const submit = (event) => { event.preventDefault(); onSubmit({ message: value.text, html: value.html, cc: value.cc, bcc: value.bcc }); };
  return <form className="mail-composer-expanded" onSubmit={submit} aria-label="Reply composer"><div className="mail-composer-row"><input className="mail-input" value={value.cc} onChange={(event) => update({ cc: event.target.value })} placeholder="CC (optional)" /><input className="mail-input" value={value.bcc} onChange={(event) => update({ bcc: event.target.value })} placeholder="BCC (optional)" /></div>{cannedResponses?.length > 0 && <select className="mail-input mail-composer-select" defaultValue="" onChange={(event) => onCannedResponse(event.target.value, (text) => update({ text }))}><option value="">Canned response</option>{cannedResponses.map((response) => <option value={response.id} key={response.id}>{response.title}</option>)}</select>}<div className="mail-composer-row"><RichEditor value={value.html} placeholder="Write a reply…" onChange={({ html, text }) => update({ html, text })} minHeight={90} /></div>{error && <p className="mail-error" aria-live="polite">{error}</p>}<div className="mail-composer-row mail-composer-actions"><button className="mail-button" type="button" onClick={onOpen}>Cancel</button><button className="mail-button mail-button-primary" type="submit" disabled={sending || !value.text.trim()}>{sending ? 'Sending…' : 'Send reply'}</button></div></form>;
}
