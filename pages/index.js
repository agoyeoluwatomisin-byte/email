import { useState } from 'react';

export default function Home() {
  const [form, setForm] = useState({ to: '', subject: '', message: '', replyTo: '' });
  const [status, setStatus] = useState({ state: 'idle', message: '' });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ state: 'loading', message: '' });

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ state: 'error', message: data.error || 'Something went wrong' });
        return;
      }

      setStatus({ state: 'success', message: 'Email sent!' });
      setForm({ to: '', subject: '', message: '', replyTo: '' });
    } catch (err) {
      setStatus({ state: 'error', message: 'Network error, please try again' });
    }
  };

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Send an email</h1>
        <p style={styles.subtitle}>Sent from your verified domain via Resend.</p>

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

          <button style={styles.button} type="submit" disabled={status.state === 'loading'}>
            {status.state === 'loading' ? 'Sending…' : 'Send email'}
          </button>

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
    background: '#0f172a',
    padding: 24,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    background: '#ffffff',
    borderRadius: 12,
    padding: 32,
    boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
  },
  h1: { margin: 0, fontSize: 24, color: '#0f172a' },
  subtitle: { marginTop: 4, marginBottom: 24, color: '#64748b', fontSize: 14 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: '#334155', fontWeight: 500 },
  input: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  button: {
    marginTop: 8,
    padding: '12px 16px',
    borderRadius: 8,
    border: 'none',
    background: '#0f172a',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  success: { color: '#16a34a', fontSize: 14, margin: 0 },
  error: { color: '#dc2626', fontSize: 14, margin: 0 },
};
