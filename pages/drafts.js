import { useEffect, useState } from 'react';

export default function Drafts() {
  const [drafts, setDrafts] = useState([]);
  const [message, setMessage] = useState('');
  const load = async () => {
    const response = await fetch('/api/drafts');
    if (response.ok) setDrafts((await response.json()).drafts || []);
  };
  useEffect(() => {
    load();
  }, []);
  const deleteDraft = async (id) => {
    const response = await fetch(`/api/drafts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) {
      setMessage('Draft deleted.');
      await load();
    }
  };
  return (
    <main style={styles.main}>
      <h1 style={styles.heading}>Drafts</h1>
      {message && <p style={styles.message}>{message}</p>}
      {drafts.length === 0 ? (
        <p style={styles.dim}>No saved drafts.</p>
      ) : (
        drafts.map((draft) => (
          <article key={draft.id} style={styles.row}>
            <div>
              <strong>{draft.subject || '(no subject)'}</strong>
              <p>
                {draft.to_address || 'No recipient'} · {new Date(draft.updated_at).toLocaleString()}
              </p>
            </div>
            <button type="button" style={styles.delete} onClick={() => deleteDraft(draft.id)}>
              Delete
            </button>
          </article>
        ))
      )}
    </main>
  );
}

const styles = {
  main: { maxWidth: 760, margin: '0 auto', padding: 28, color: '#e5eef8' },
  heading: { marginTop: 0 },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
    padding: 16,
    marginBottom: 10,
    background: '#102033',
    border: '1px solid #29415b',
    borderRadius: 9,
  },
  delete: {
    border: '1px solid #7f1d1d',
    background: 'transparent',
    color: '#fca5a5',
    borderRadius: 6,
    padding: '6px 9px',
    cursor: 'pointer',
  },
  dim: { color: '#94a3b8' },
  message: { color: '#86efac' },
};
