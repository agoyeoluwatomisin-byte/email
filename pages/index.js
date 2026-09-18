import { useEffect, useMemo, useState } from 'react';

const quickContacts = ['hello@yourdomain.com', 'support@yourdomain.com', 'sales@yourdomain.com'];

export default function Home() {
  const [form, setForm] = useState({ to: '', cc: '', bcc: '', subject: '', message: '', replyTo: '' });
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [attachments, setAttachments] = useState([]);
  const [draftSaved, setDraftSaved] = useState(false);

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
    <main style={styles.main}>
      <div style={styles.card}>
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

        <form onSubmit={handleSubmit} style={styles.form}>
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
                  <span key={file.name} style={styles.attachmentItem}>{file.name}</span>
                ))}
              </div>
            )}
          </label>

          <div style={styles.formFooter}>
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
