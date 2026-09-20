import { useEffect, useState } from 'react';

export default function Settings() {
  const [signature, setSignature] = useState({ signature_html: '', signature_text: '' });
  const [responses, setResponses] = useState([]);
  const [form, setForm] = useState({ title: '', category: 'General', body: '' });
  const [message, setMessage] = useState('');
  const [report, setReport] = useState({ enabled: false, recipient_emails: [], weekday: 1, hour: 9 });

  const load = async () => {
    const [signatureResponse, cannedResponse, reportResponse] = await Promise.all([
      fetch('/api/signature'),
      fetch('/api/canned-responses'),
      fetch('/api/reports'),
    ]);
    if (signatureResponse.ok) setSignature((await signatureResponse.json()).signature);
    if (cannedResponse.ok) setResponses((await cannedResponse.json()).responses || []);
    if (reportResponse.ok) setReport((await reportResponse.json()).settings);
  };

  useEffect(() => {
    load();
  }, []);

  const saveSignature = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/signature', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signature),
    });
    setMessage(response.ok ? 'Signature saved.' : 'Unable to save signature.');
  };

  const saveResponse = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/canned-responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (response.ok) {
      setForm({ title: '', category: 'General', body: '' });
      await load();
      setMessage('Canned response saved.');
    } else setMessage('Unable to save canned response.');
  };

  const deleteResponse = async (id) => {
    await fetch(`/api/canned-responses?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await load();
  };

  const saveReport = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/reports', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...report, recipientEmails: report.recipient_emails }),
    });
    setMessage(response.ok ? 'Weekly report settings saved.' : 'Unable to save report settings.');
  };

  return (
    <main style={styles.main}>
      <h1 style={styles.heading}>Settings</h1>
      {message && <p style={styles.message}>{message}</p>}
      <section style={styles.section}>
        <h2 style={styles.subheading}>Signature</h2>
        <form onSubmit={saveSignature} style={styles.form}>
          <label style={styles.label}>
            Signature HTML
            <textarea
              style={styles.textarea}
              value={signature.signature_html}
              onChange={(event) => setSignature({ ...signature, signature_html: event.target.value })}
              maxLength={10000}
            />
          </label>
          <label style={styles.label}>
            Plain-text fallback
            <textarea
              style={styles.textarea}
              value={signature.signature_text}
              onChange={(event) => setSignature({ ...signature, signature_text: event.target.value })}
              maxLength={5000}
            />
          </label>
          <button style={styles.button} type="submit">
            Save signature
          </button>
        </form>
      </section>
      <section style={styles.section}>
        <h2 style={styles.subheading}>Weekly report</h2>
        <form onSubmit={saveReport} style={styles.form}>
          <label style={styles.label}>
            <input
              type="checkbox"
              checked={Boolean(report.enabled)}
              onChange={(event) => setReport({ ...report, enabled: event.target.checked })}
            />{' '}
            Send weekly summary
          </label>
          <input
            style={styles.input}
            placeholder="Recipients, comma separated"
            value={(report.recipient_emails || []).join(', ')}
            onChange={(event) =>
              setReport({
                ...report,
                recipient_emails: event.target.value
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
          />
          <label style={styles.label}>
            Day
            <select
              style={styles.input}
              value={report.weekday}
              onChange={(event) => setReport({ ...report, weekday: Number(event.target.value) })}
            >
              <option value={1}>Monday</option>
              <option value={2}>Tuesday</option>
              <option value={3}>Wednesday</option>
              <option value={4}>Thursday</option>
              <option value={5}>Friday</option>
              <option value={6}>Saturday</option>
              <option value={0}>Sunday</option>
            </select>
          </label>
          <label style={styles.label}>
            UTC hour
            <input
              style={styles.input}
              type="number"
              min="0"
              max="23"
              value={report.hour}
              onChange={(event) => setReport({ ...report, hour: Number(event.target.value) })}
            />
          </label>
          <button style={styles.button} type="submit">
            Save report settings
          </button>
        </form>
      </section>
      <section style={styles.section}>
        <h2 style={styles.subheading}>Canned responses</h2>
        <form onSubmit={saveResponse} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Title"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            maxLength={160}
            required
          />
          <input
            style={styles.input}
            placeholder="Category"
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
            maxLength={80}
          />
          <textarea
            style={styles.textarea}
            placeholder="Use {{customer_name}}, {{agent_name}}, or {{thread_subject}}"
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
            maxLength={10000}
            required
          />
          <button style={styles.button} type="submit">
            Add response
          </button>
        </form>
        <div style={styles.list}>
          {responses.map((response) => (
            <div key={response.id} style={styles.row}>
              <div>
                <strong>{response.title}</strong>
                <small>{response.category}</small>
              </div>
              <button style={styles.delete} type="button" onClick={() => deleteResponse(response.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

const styles = {
  main: { maxWidth: 760, margin: '0 auto', padding: 28, color: '#e5eef8' },
  heading: { marginTop: 0 },
  subheading: { marginTop: 0, fontSize: 18 },
  section: { background: '#102033', border: '1px solid #29415b', borderRadius: 10, padding: 20, marginBottom: 18 },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  label: { display: 'flex', flexDirection: 'column', gap: 5, color: '#b7c7d8', fontSize: 13 },
  input: { padding: 10, borderRadius: 7, border: '1px solid #36536e', background: '#0d1a2a', color: '#e5eef8' },
  textarea: {
    minHeight: 90,
    padding: 10,
    borderRadius: 7,
    border: '1px solid #36536e',
    background: '#0d1a2a',
    color: '#e5eef8',
    fontFamily: 'inherit',
  },
  button: {
    alignSelf: 'flex-start',
    padding: '8px 12px',
    border: 0,
    borderRadius: 7,
    background: '#2f8fca',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
  message: { color: '#86efac' },
  list: { marginTop: 16 },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid #29415b',
    padding: '10px 0',
  },
  delete: {
    border: '1px solid #7f1d1d',
    background: 'transparent',
    color: '#fca5a5',
    borderRadius: 6,
    padding: '5px 8px',
    cursor: 'pointer',
  },
};
