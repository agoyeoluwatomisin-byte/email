import { useEffect, useMemo, useState } from 'react';

export default function Inbox() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/emails');
    const data = await res.json();
    setEmails(data.emails || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Group flat email list into threads, newest thread first
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

  const activeThread = threads.find((t) => t[0].thread_id === selectedThread);
  const lastInbound = activeThread ? [...activeThread].reverse().find((m) => m.direction === 'inbound') : null;

  const handleReply = async (e) => {
    e.preventDefault();
    const trimmedReply = replyText.trim();

    if (!lastInbound) {
      setReplyError('Select a message to reply to.');
      return;
    }

    if (!trimmedReply) {
      setReplyError('Reply cannot be empty.');
      return;
    }

    setReplyError('');
    setSending(true);

    try {
      const res = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: lastInbound.thread_id,
          to: lastInbound.from_address,
          subject: lastInbound.subject,
          message: trimmedReply,
          inReplyToMessageId: lastInbound.message_id,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        setReplyError(payload.error || 'Unable to send the reply.');
        return;
      }

      setReplyText('');
      await load();
    } catch (error) {
      setReplyError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main style={styles.main}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.h2}>Inbox</h2>
          <button style={styles.refreshBtn} onClick={load}>⟳</button>
        </div>
        {loading && <p style={styles.dim}>Loading…</p>}
        {!loading && threads.length === 0 && <p style={styles.dim}>No emails yet.</p>}
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
              <div style={styles.threadFrom}>{latest.from_address}</div>
              <div style={styles.threadSubject}>{latest.subject || '(no subject)'}</div>
              <div style={styles.threadDate}>{new Date(latest.received_at).toLocaleString()}</div>
            </button>
          );
        })}
      </aside>

      <section style={styles.conversation}>
        {!activeThread && <p style={styles.dim}>Select a conversation.</p>}

        {activeThread && (
          <>
            <h3 style={styles.threadTitle}>{activeThread[0].subject || '(no subject)'}</h3>
            <div style={styles.messages}>
              {activeThread.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    ...styles.messageBubble,
                    alignSelf: msg.direction === 'outbound' ? 'flex-end' : 'flex-start',
                    background: msg.direction === 'outbound' ? '#0f172a' : '#f1f5f9',
                    color: msg.direction === 'outbound' ? '#fff' : '#0f172a',
                  }}
                >
                  <div style={styles.messageMeta}>
                    {msg.direction === 'outbound' ? 'You' : msg.from_address} ·{' '}
                    {new Date(msg.received_at).toLocaleString()}
                  </div>
                  <div>{msg.text_body}</div>
                </div>
              ))}
            </div>

            <div style={styles.replyHeader}>
              <strong>Reply to:</strong>{' '}
              {lastInbound?.from_address || 'selected sender'}
            </div>

            <form onSubmit={handleReply} style={styles.replyForm}>
              <textarea
                style={styles.textarea}
                placeholder="Write a reply…"
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value);
                  if (replyError) setReplyError('');
                }}
              />
              <button style={styles.sendBtn} type="submit" disabled={sending || !replyText.trim()}>
                {sending ? 'Sending…' : 'Reply'}
              </button>
            </form>

            {replyError && <p style={styles.replyError}>{replyError}</p>}
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
  threadFrom: { fontSize: 13, fontWeight: 600 },
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
  replyHeader: {
    marginTop: 16,
    padding: '8px 10px',
    borderRadius: 8,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#334155',
    fontSize: 14,
  },
  replyForm: { display: 'flex', gap: 8, marginTop: 12 },
  textarea: {
    flex: 1,
    minHeight: 60,
    padding: 10,
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontFamily: 'inherit',
    fontSize: 14,
    resize: 'vertical',
  },
  sendBtn: {
    padding: '0 20px',
    borderRadius: 8,
    border: 'none',
    background: '#0f172a',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  replyError: { color: '#dc2626', fontSize: 13, marginTop: 8, marginBottom: 0 },
};
