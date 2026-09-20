import { useEffect, useMemo, useState } from 'react';
import RichEditor from '../components/RichEditor';

const quickContacts = ['hello@yourdomain.com', 'support@yourdomain.com', 'sales@yourdomain.com'];

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${sizes[index]}`;
}

function getSpamRiskScore({ to, subject, message }) {
  let score = 0;
  const text = `${to || ''} ${subject || ''} ${message || ''}`.toLowerCase();

  if (!to || !to.includes('@')) score += 25;
  if (/(free|winner|click now|urgent|limited time|claim)/i.test(text)) score += 30;
  if (/\b[a-z]{1,2}\b/.test(text) && text.length > 300) score += 10;
  if ((text.match(/!+/g) || []).length > 1) score += 10;
  if ((text.match(/\b[A-Z]{5,}\b/g) || []).length > 0) score += 8;
  if ((text.match(/\bhttps?:\/\//gi) || []).length > 0) score += 15;
  if (subject && subject.length > 80) score += 10;

  return Math.min(score, 100);
}

export default function ComposePage() {
  const [form, setForm] = useState({ to: '', cc: '', bcc: '', subject: '', message: '', html: '', replyTo: '' });
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [attachments, setAttachments] = useState([]);
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [undoPayload, setUndoPayload] = useState(null);
  const [undoSeconds, setUndoSeconds] = useState(0);
  const [scheduledAt, setScheduledAt] = useState('');
  const [confirmRiskySend, setConfirmRiskySend] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    fetch('/api/drafts')
      .then((response) => (response.ok ? response.json() : { drafts: [] }))
      .then((data) => {
        const draft = data.drafts?.find((item) => item.kind === 'compose');
        if (draft) {
          setDraftId(draft.id);
          setForm({
            to: draft.to_address,
            cc: draft.cc,
            bcc: draft.bcc,
            subject: draft.subject,
            message: draft.text_body,
            html: draft.html_body,
            replyTo: draft.reply_to,
          });
          setAttachments(draft.attachments || []);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const response = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draftId, kind: 'compose', ...form, attachments }),
      });
      if (response.ok) {
        const data = await response.json();
        setDraftId(data.draft?.id || draftId);
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 800);
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [form, attachments, draftId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files || []);

    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = String(reader.result || '');
              resolve({
                name: file.name,
                contentType: file.type || 'application/octet-stream',
                size: file.size,
                content: result.includes('base64,') ? result.split('base64,')[1] : result,
              });
            };
            reader.readAsDataURL(file);
          }),
      ),
    ).then(async (normalized) => {
      const response = await fetch('/api/attachments/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: normalized }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus({ state: 'error', message: data.error || 'Unable to upload attachments.' });
        return;
      }
      setAttachments(data.attachments || []);
    });
  };

  const sendNow = async (payload) => {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const spamRisk = getSpamRiskScore({ to: form.to, subject: form.subject, message: form.message });

    if (spamRisk >= 60 && !confirmRiskySend) {
      setStatus({
        state: 'warning',
        message: `Spam risk score: ${spamRisk}/100. Review the message before sending.`,
      });
      return;
    }

    const payload = { ...form, attachments };
    if (scheduledAt) {
      setStatus({ state: 'loading', message: '' });
      try {
        const response = await fetch('/api/scheduled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduledAt: new Date(scheduledAt).toISOString(), payload }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to schedule email.');
        setStatus({ state: 'success', message: 'Email scheduled.' });
        setScheduledAt('');
        setForm({ to: '', cc: '', bcc: '', subject: '', message: '', html: '', replyTo: '' });
        setAttachments([]);
      } catch (error) {
        setStatus({ state: 'error', message: error.message });
      }
      return;
    }

    setUndoPayload(payload);
    setUndoSeconds(10);
    setStatus({ state: 'warning', message: 'Email held for 10 seconds.' });
    return;
  };

  useEffect(() => {
    if (!undoPayload) return undefined;
    const interval = setInterval(() => setUndoSeconds((current) => Math.max(current - 1, 0)), 1000);
    const timeout = setTimeout(async () => {
      try {
        await sendNow(undoPayload);
        setStatus({ state: 'success', message: 'Email sent!' });
        setUndoPayload(null);
        setForm({ to: '', cc: '', bcc: '', subject: '', message: '', html: '', replyTo: '' });
        setAttachments([]);
      } catch (error) {
        setStatus({ state: 'error', message: error.message });
      }
    }, 10000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [undoPayload]);

  const handleUndo = () => {
    setUndoPayload(null);
    setUndoSeconds(0);
    setStatus({ state: 'idle', message: 'Send cancelled.' });
  };

  const missingSender = useMemo(
    () => !process.env.NEXT_PUBLIC_RESEND_FROM_ADDRESS && !process.env.RESEND_FROM_ADDRESS,
    [],
  );

  return (
    <main className="compose-page" style={styles.main}>
      <div className="compose-card" style={styles.card}>
        <h1 style={styles.h1}>Send an email</h1>
        <p style={styles.subtitle}>Sent from your verified domain via Resend.</p>

        {missingSender && (
          <div style={styles.warning}>
            Set <strong>RESEND_FROM_ADDRESS</strong> in your environment before sending mail from this app.
          </div>
        )}

        <div style={styles.quickContactsWrap}>
          <span style={styles.quickLabel}>Quick contacts</span>
          <div style={styles.quickContacts}>
            {quickContacts.map((contact) => (
              <button
                key={contact}
                type="button"
                style={styles.contactChip}
                onClick={() => setForm((current) => ({ ...current, to: contact }))}
              >
                {contact}
              </button>
            ))}
          </div>
        </div>

        {status.state === 'warning' && (
          <div style={styles.warningBox}>
            <strong>Review required:</strong> {status.message}
            {undoPayload ? (
              <button type="button" style={styles.warningAction} onClick={handleUndo}>
                Undo ({undoSeconds}s)
              </button>
            ) : (
              <button
                type="button"
                style={styles.warningAction}
                onClick={() => {
                  setConfirmRiskySend(true);
                  setStatus({ state: 'idle', message: '' });
                }}
              >
                Send anyway
              </button>
            )}
          </div>
        )}

        <form className="compose-form" onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            To
            <input
              style={styles.input}
              type="email"
              name="to"
              required
              value={form.to}
              onChange={handleChange}
              placeholder="someone@example.com"
            />
          </label>
          <div style={styles.row}>
            <label style={styles.labelHalf}>
              CC
              <input style={styles.input} type="email" name="cc" value={form.cc} onChange={handleChange} placeholder="cc@example.com" />
            </label>
            <label style={styles.labelHalf}>
              BCC
              <input style={styles.input} type="email" name="bcc" value={form.bcc} onChange={handleChange} placeholder="bcc@example.com" />
            </label>
          </div>
          <label style={styles.label}>
            Subject
            <input style={styles.input} type="text" name="subject" value={form.subject} onChange={handleChange} placeholder="Subject" />
          </label>
          <label style={styles.label}>
            Reply-to
            <input style={styles.input} type="email" name="replyTo" value={form.replyTo} onChange={handleChange} placeholder="reply@example.com" />
          </label>

          <div style={styles.editorWrap}>
            <RichEditor value={form.message} onChange={(value) => setForm((current) => ({ ...current, message: value }))} />
          </div>

          <div style={styles.footer}>
            <label style={styles.scheduleWrap}>
              <span>Schedule send</span>
              <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} style={styles.input} />
            </label>
            <div style={styles.actions}>
              <label style={styles.uploadLabel}>
                Attach files
                <input type="file" multiple onChange={handleAttachmentChange} style={styles.fileInput} />
              </label>
              <button type="submit" style={styles.submitButton}>
                {scheduledAt ? 'Schedule email' : 'Send now'}
              </button>
            </div>
          </div>

          {attachments.length > 0 && (
            <div style={styles.attachmentList}>
              {attachments.map((attachment) => (
                <div key={attachment.name + attachment.size} style={styles.attachmentItem}>
                  <span>{attachment.name}</span>
                  <span>{formatBytes(attachment.size)}</span>
                </div>
              ))}
            </div>
          )}

          {draftSaved && <div style={styles.savedBanner}>Draft saved</div>}
          {status.state === 'success' && <div style={styles.success}>{status.message}</div>}
          {status.state === 'error' && <div style={styles.error}>{status.message}</div>}
        </form>
      </div>
    </main>
  );
}

const styles = {
  main: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(180deg, #07111f 0%, #0d1c2d 100%)',
    color: '#e5eef8',
    padding: '32px 20px',
  },
  card: {
    width: '100%',
    maxWidth: 960,
    background: '#102033',
    border: '1px solid rgba(120, 145, 172, 0.28)',
    borderRadius: 18,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.24)',
    padding: '28px 26px',
  },
  h1: {
    margin: '0 0 8px',
    fontSize: '2rem',
  },
  subtitle: {
    margin: '0 0 20px',
    color: '#9fb2c6',
  },
  warning: {
    marginBottom: 18,
    padding: '10px 12px',
    background: 'rgba(244, 184, 96, 0.12)',
    border: '1px solid rgba(244, 184, 96, 0.4)',
    borderRadius: 10,
    color: '#f5d38b',
  },
  quickContactsWrap: {
    display: 'grid',
    gap: 8,
    marginBottom: 18,
  },
  quickLabel: {
    fontSize: 12,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#9fb2c6',
  },
  quickContacts: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 7,
  },
  contactChip: {
    border: '1px solid rgba(120, 145, 172, 0.4)',
    background: '#13283d',
    color: '#e5eef8',
    borderRadius: 999,
    padding: '6px 10px',
    cursor: 'pointer',
  },
  warningBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(244, 184, 96, 0.45)',
    background: 'rgba(244, 184, 96, 0.12)',
    color: '#f5d38b',
    marginBottom: 18,
  },
  warningAction: {
    background: 'transparent',
    border: '1px solid rgba(245, 211, 139, 0.45)',
    color: '#f5d38b',
    borderRadius: 8,
    padding: '7px 10px',
    cursor: 'pointer',
  },
  form: {
    display: 'grid',
    gap: 18,
  },
  label: {
    display: 'grid',
    gap: 8,
    color: '#dfeaf7',
    fontWeight: 600,
  },
  labelHalf: {
    display: 'grid',
    gap: 8,
    color: '#dfeaf7',
    fontWeight: 600,
    flex: 1,
  },
  row: {
    display: 'flex',
    gap: 14,
  },
  input: {
    padding: '10px 12px',
    background: '#13283d',
    border: '1px solid rgba(120, 145, 172, 0.35)',
    color: '#e5eef8',
    borderRadius: 10,
  },
  editorWrap: {
    border: '1px solid rgba(120, 145, 172, 0.35)',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#13283d',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'end',
  },
  scheduleWrap: {
    display: 'grid',
    gap: 8,
    width: '100%',
    maxWidth: 260,
    color: '#dfeaf7',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  uploadLabel: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(120, 145, 172, 0.35)',
    background: '#13283d',
    color: '#dfeaf7',
    cursor: 'pointer',
  },
  fileInput: {
    position: 'absolute',
    inset: 0,
    opacity: 0,
    cursor: 'pointer',
  },
  submitButton: {
    padding: '11px 16px',
    border: 0,
    borderRadius: 10,
    background: '#55b3e8',
    color: '#07111f',
    fontWeight: 800,
    cursor: 'pointer',
  },
  attachmentList: {
    display: 'grid',
    gap: 8,
  },
  attachmentItem: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 10px',
    borderRadius: 8,
    background: '#13283d',
    border: '1px solid rgba(120, 145, 172, 0.3)',
    color: '#dfeaf7',
  },
  savedBanner: {
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(99, 212, 154, 0.12)',
    border: '1px solid rgba(99, 212, 154, 0.4)',
    color: '#9ae6b4',
  },
  success: {
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(99, 212, 154, 0.12)',
    border: '1px solid rgba(99, 212, 154, 0.4)',
    color: '#9ae6b4',
  },
  error: {
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(242, 139, 130, 0.12)',
    border: '1px solid rgba(242, 139, 130, 0.4)',
    color: '#f8b0a5',
  },
};