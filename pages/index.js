import { useEffect, useMemo, useState } from 'react';

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

export default function Home() {
  const [form, setForm] = useState({ to: '', cc: '', bcc: '', subject: '', message: '', replyTo: '' });
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [attachments, setAttachments] = useState([]);
  const [draftSaved, setDraftSaved] = useState(false);
  const [confirmRiskySend, setConfirmRiskySend] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedDraft = localStorage.getItem('email-compose-draft');
    if (savedDraft) {
      try {
        setForm({ ...form, ...JSON.parse(savedDraft) });
      } catch (error) {
        // ignore malformed draft
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('email-compose-draft', JSON.stringify(form));
    setDraftSaved(true);
    const timeout = setTimeout(() => setDraftSaved(false), 800);
    return () => clearTimeout(timeout);
  }, [form]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files || []);

    const mapped = files.map((file) => ({
      name: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      content: '',
    }));

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
          })
      )
    ).then((normalized) => setAttachments(normalized));
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

    setStatus({ state: 'loading', message: '' });

    try {
      const payload = {
        ...form,
        attachments,
      };

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ state: 'error', message: data.error || 'Something went wrong' });
        return;
      }

      localStorage.removeItem('email-compose-draft');
      setStatus({ state: 'success', message: 'Email sent!' });
      setConfirmRiskySend(false);
      setForm({ to: '', cc: '', bcc: '', subject: '', message: '', replyTo: '' });
      setAttachments([]);
    } catch (err) {
      setStatus({ state: 'error', message: 'Network error, please try again' });
    }
  };

  const missingSender = useMemo(
    () => !process.env.NEXT_PUBLIC_RESEND_FROM_ADDRESS && !process.env.RESEND_FROM_ADDRESS,
    []
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

          <label style={styles.label}>
            CC (optional)
            <input style={styles.input} type="text" name="cc" value={form.cc} onChange={handleChange} placeholder="cc@example.com" />
          </label>

          <label style={styles.label}>
            BCC (optional)
            <input style={styles.input} type="text" name="bcc" value={form.bcc} onChange={handleChange} placeholder="bcc@example.com" />
          </label>

          <label style={styles.label}>
            Subject
            <input
              style={styles.input}
              type="text"
              name="subject"
              required
              value={form.subject}
              onChange={handleChange}
              placeholder="Subject line"
            />
          </label>

          <label style={styles.label}>
            Message
            <textarea
              style={{ ...styles.input, minHeight: 140, resize: 'vertical' }}
              name="message"
              required
              value={form.message}
              onChange={handleChange}
              placeholder="Write your message..."
            />
          </label>

          <label style={styles.label}>
            Reply-to (optional)
            <input
              style={styles.input}
              type="email"
              name="replyTo"
              value={form.replyTo}
              onChange={handleChange}
              placeholder="you@example.com"
            />
          </label>

          <label style={styles.label}>
            Attachments (optional)
            <input style={styles.fileInput} type="file" multiple onChange={handleAttachmentChange} />
            {attachments.length > 0 && (
              <div style={styles.attachmentList}>
                {attachments.map((file) => (
                  <span key={`${file.name}-${file.size}`} style={styles.attachmentItem}>
                    {file.name} · {formatBytes(file.size)} · {file.contentType.split('/')[1] || 'file'}
                  </span>
                ))}
              </div>
            )}
          </label>

          <div className="compose-footer" style={styles.formFooter}>
            <button style={styles.button} type="submit" disabled={status.state === 'loading'}>
              {status.state === 'loading' ? 'Sending…' : 'Send email'}
            </button>
            <span style={styles.draftStatus}>{draftSaved ? 'Draft saved' : 'Autosaved'}</span>
          </div>

          {status.state === 'success' && <p style={styles.success}>{status.message}</p>}
          {status.state === 'error' && <p style={styles.error}>{status.message}</p>}
        </form>
      </div>
    </main>
  );
}

const styles = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#07111f',
    padding: 24,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 560,
    background: '#102033',
    borderRadius: 12,
    padding: 32,
    boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
  },
  h1: { margin: 0, fontSize: 24, color: '#f1f5f9' },
  subtitle: { marginTop: 4, marginBottom: 20, color: '#9fb2c6', fontSize: 14 },
  warning: {
    background: '#fff7ed',
    color: '#9a5b00',
    border: '1px solid #fed7aa',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 18,
    fontSize: 13,
  },
  quickContactsWrap: { marginBottom: 16 },
  quickLabel: { display: 'block', marginBottom: 8, fontSize: 12, color: '#b7c7d8', fontWeight: 600 },
  quickContacts: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  contactChip: {
    border: '1px solid #cbd5e1',
    background: '#17283b',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    cursor: 'pointer',
    color: '#d7e5f2',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: '#d7e5f2', fontWeight: 500 },
  input: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #36536e',
    background: '#0d1a2a',
    color: '#e5eef8',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  fileInput: { padding: '10px 0', fontSize: 13, color: '#c5d4e2' },
  warningBox: {
    background: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.5)',
    borderRadius: 10,
    color: '#fcd34d',
    padding: '10px 12px',
    marginBottom: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    fontSize: 13,
  },
  warningAction: {
    background: '#f59e0b',
    border: 'none',
    borderRadius: 6,
    color: '#1f2937',
    padding: '6px 10px',
    cursor: 'pointer',
    fontWeight: 700,
  },
  attachmentList: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  attachmentItem: {
    background: '#173b5f',
    border: '1px solid #2f638d',
    borderRadius: 999,
    color: '#c5e5ff',
    fontSize: 12,
    padding: '5px 8px',
  },
  formFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 4 },
  button: {
    padding: '12px 16px',
    borderRadius: 8,
    border: 'none',
    background: '#0f172a',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  draftStatus: { fontSize: 12, color: '#9fb2c6' },
  success: { color: '#86efac', fontSize: 14, margin: 0 },
  error: { color: '#fca5a5', fontSize: 14, margin: 0 },
};
