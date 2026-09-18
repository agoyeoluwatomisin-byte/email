import { useEffect, useMemo, useState } from 'react';

export default function Outbox() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/emails');
    const data = await res.json();
    setEmails((data.emails || []).filter((email) => email.direction === 'outbound'));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const threads = useMemo(() => {
    const map = new Map();
    for (const email of emails) {
      if (!map.has(email.thread_id)) map.set(email.thread_id, []);
      map.get(email.thread_id).push(email);
    }

    return [...map.values()]
      .map((msgs) => msgs.sort((a, b) => new Date(a.received_at) - new Date(b.received_at)))
      .sort((a, b) => new Date(b[b.length - 1].received_at) - new Date(a[a.length - 1].received_at));
  }, [emails]);

  const activeThread = threads.find((thread) => thread[0].thread_id === selectedThread);

  return (
    <main style={styles.main}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.h2}>Outbox</h2>
          <button style={styles.refreshBtn} onClick={load}>⟳</button>
        </div>

        {loading && <p style={styles.dim}>Loading…</p>}
        {!loading && threads.length === 0 && <p style={styles.dim}>No sent emails yet.</p>}

        {threads.map((thread) => {
          const latest = thread[thread.length - 1];
          return (
            <button
              key={thread[0].thread_id}
              onClick={() => setSelectedThread(thread[0].thread_id)}
              style={{
                ...styles.threadItem,
                background: selectedThread === thread[0].thread_id ? '#1e293b' : 'transparent',
              }}
            >
              <div style={styles.threadTo}>{latest.to_address || 'Unknown recipient'}</div>
              <div style={styles.threadSubject}>{latest.subject || '(no subject)'}</div>
              <div style={styles.threadDate}>{new Date(latest.received_at).toLocaleString()}</div>
            </button>
          );
        })}
      </aside>

      <section style={styles.conversation}>
        {!activeThread && <p style={styles.dim}>Select a sent message.</p>}

        {activeThread && (
          <>
            <h3 style={styles.threadTitle}>{activeThread[0].subject || '(no subject)'}</h3>
            <div style={styles.messages}>
              {activeThread.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    ...styles.messageBubble,
                    alignSelf: 'flex-end',
                    background: '#0f172a',
                    color: '#fff',
                  }}
                >
                  <div style={styles.messageMeta}>You · {new Date(msg.received_at).toLocaleString()}</div>
                  <div>{msg.text_body || '(empty message)'}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

const styles = {
  main: { display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' },
  sidebar: {
    width: 320,
    borderRight: '1px solid #1e293b',
    background: '#0b1220',
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 16px 8px',
  },
  h2: { margin: 0, fontSize: 18 },
  refreshBtn: {
    background: 'none',
    border: '1px solid #334155',
    color: '#e2e8f0',
    borderRadius: 6,
    padding: '4px 8px',
    cursor: 'pointer',
  },
  dim: { color: '#64748b', padding: '0 16px', fontSize: 14 },
  threadItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '12px 16px',
    border: 'none',
    borderBottom: '1px solid #1e293b',
    cursor: 'pointer',
    color: 'inherit',
  },
  threadTo: { fontSize: 13, fontWeight: 600 },
  threadSubject: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  threadDate: { fontSize: 11, color: '#64748b', marginTop: 4 },
  conversation: {
    flex: 1,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  threadTitle: { marginTop: 0 },
  messages: { display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' },
  messageBubble: { maxWidth: '70%', padding: 12, borderRadius: 10, fontSize: 14 },
  messageMeta: { fontSize: 11, opacity: 0.7, marginBottom: 4 },
};
