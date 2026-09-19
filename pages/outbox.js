import { useEffect, useMemo, useState } from 'react';

export default function Outbox() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedMessageIds, setExpandedMessageIds] = useState([]);
  const [hiddenThreadIds, setHiddenThreadIds] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/emails?direction=outbound');
    const data = await res.json();
    setEmails((data.emails || []).map((email) => ({
      ...email,
      attachments: Array.isArray(email.attachments) ? email.attachments : [],
    })));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const visibleThreads = useMemo(() => {
    const map = new Map();
    for (const email of emails) {
      if (!map.has(email.thread_id)) map.set(email.thread_id, []);
      map.get(email.thread_id).push(email);
    }

    const grouped = [...map.values()]
      .filter((thread) => !hiddenThreadIds.includes(thread[0].thread_id))
      .map((msgs) => msgs.sort((a, b) => new Date(a.received_at) - new Date(b.received_at)))
      .sort((a, b) => new Date(b[b.length - 1].received_at) - new Date(a[a.length - 1].received_at));

    const normalized = search.trim().toLowerCase();
    if (!normalized) return grouped;

    return grouped.filter((thread) => {
      const text = thread
        .map((msg) => `${msg.to_address || ''} ${msg.subject || ''} ${msg.text_body || ''}`)
        .join(' ')
        .toLowerCase();
      return text.includes(normalized);
    });
  }, [emails, hiddenThreadIds, search]);

  const activeThread = visibleThreads.find((thread) => thread[0].thread_id === selectedThread);

  const handleSelectThread = (threadId) => {
    setSelectedThread(threadId);
    setIsSidebarOpen(false);
  };

  const handleArchiveThread = (threadId) => {
    setHiddenThreadIds((current) => [...current, threadId]);
    if (selectedThread === threadId) setSelectedThread(null);
  };

  const handleDeleteThread = async (threadId) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this sent thread permanently?')) return;

    const res = await fetch(`/api/emails/${threadId}`, { method: 'DELETE' });
    if (!res.ok) return;

    setHiddenThreadIds((current) => [...current, threadId]);
    if (selectedThread === threadId) setSelectedThread(null);
    await load();
  };

  const toggleMessageExpand = (messageId) => {
    setExpandedMessageIds((current) =>
      current.includes(messageId) ? current.filter((id) => id !== messageId) : [...current, messageId]
    );
  };

  return (
    <main className="mail-layout" style={styles.main}>
      <aside className={isSidebarOpen ? 'mail-sidebar-open' : 'mail-sidebar-closed'} style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.h2}>Outbox</h2>
          <div style={styles.headerActions}>
            <button style={styles.refreshBtn} onClick={load}>⟳</button>
            <button
              type="button"
              className="mobile-sidebar-toggle"
              style={styles.sidebarToggle}
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Hide outbox list"
            >
              ×
            </button>
          </div>
        </div>

        <div style={styles.searchWrap}>
          <input
            style={styles.searchInput}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipient or subject"
          />
        </div>

        {loading && <p style={styles.dim}>Loading…</p>}
        {!loading && visibleThreads.length === 0 && <p style={styles.dim}>No sent emails match your search.</p>}

        {visibleThreads.map((thread) => {
          const latest = thread[thread.length - 1];
          const preview = (latest?.text_body || latest?.subject || '').replace(/\s+/g, ' ').trim();
          return (
            <button
              key={thread[0].thread_id}
              onClick={() => handleSelectThread(thread[0].thread_id)}
              style={{
                ...styles.threadItem,
                background: selectedThread === thread[0].thread_id ? '#1e293b' : 'transparent',
              }}
            >
              <div style={styles.threadTopRow}>
                <div style={styles.threadTo}>{latest.to_address || 'Unknown recipient'}</div>
                <button
                  type="button"
                  style={styles.archiveBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchiveThread(thread[0].thread_id);
                  }}
                >
                  Archive
                </button>
              </div>
              <div style={styles.threadSubject}>{latest.subject || '(no subject)'}</div>
              <div style={styles.threadPreview}>{preview.slice(0, 90)}{preview.length > 90 ? '…' : ''}</div>
              <div style={styles.threadDate}>{new Date(latest.received_at).toLocaleString()}</div>
            </button>
          );
        })}
      </aside>

      <section className="mail-conversation" style={styles.conversation}>
        <button
          type="button"
          className="mobile-sidebar-toggle mobile-inbox-toggle"
          style={styles.outboxToggle}
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Show outbox list"
        >
          ‹ Outbox
        </button>
        {!activeThread && <p style={styles.dim}>Select a sent message.</p>}

        {activeThread && (
          <>
            <h3 style={styles.threadTitle}>{activeThread[0].subject || '(no subject)'}</h3>
            <div style={styles.threadToolbar}>
              <button type="button" style={styles.secondaryBtn} onClick={() => handleDeleteThread(activeThread[0].thread_id)}>
                Delete thread
              </button>
            </div>
            <div style={styles.messages}>
              {activeThread.map((msg) => {
                const isExpanded = expandedMessageIds.includes(msg.id);
                const content = msg.text_body || '(empty message)';
                const body = content.length > 300 && !isExpanded ? `${content.slice(0, 300)}…` : content;
                const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];

                return (
                  <div
                    key={msg.id}
                    style={{
                      ...styles.messageBubble,
                      alignSelf: 'flex-end',
                      background: '#173b5f',
                      color: '#e5eef8',
                    }}
                  >
                    <div style={styles.messageMeta}>You · {new Date(msg.received_at).toLocaleString()}</div>
                    <div style={styles.messageBody}>{body}</div>
                    {attachments.length > 0 && (
                      <div style={styles.attachmentList}>
                        {attachments.map((attachment, index) => (
                          <span key={`${attachment.filename || attachment.name || 'file'}-${index}`} style={styles.attachmentItem}>
                            <a href={`/api/emails/${msg.id}/attachment?index=${index}`} target="_blank" rel="noreferrer" style={styles.attachmentLink}>
                              {attachment.filename || attachment.name || 'Attachment'}
                            </a>
                            {attachment.content && <a href={`/api/emails/${msg.id}/attachment?index=${index}&download=1`} style={styles.downloadLink}>Download</a>}
                          </span>
                        ))}
                      </div>
                    )}
                    {content.length > 300 && (
                      <button type="button" style={styles.expandBtn} onClick={() => toggleMessageExpand(msg.id)}>
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

const styles = {
  main: { display: 'flex', minHeight: 'calc(100vh - 68px)', height: 'calc(100vh - 68px)', background: '#07111f', fontFamily: 'system-ui, -apple-system, sans-serif' },
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
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  h2: { margin: 0, fontSize: 18 },
  searchWrap: { padding: '0 16px 12px' },
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #334155',
    background: '#111827',
    color: '#e2e8f0',
    fontSize: 14,
  },
  refreshBtn: {
    background: 'none',
    border: '1px solid #334155',
    color: '#e2e8f0',
    borderRadius: 6,
    padding: '4px 8px',
    cursor: 'pointer',
  },
  sidebarToggle: {
    display: 'none',
    background: 'transparent',
    border: '1px solid #334155',
    color: '#e2e8f0',
    borderRadius: 6,
    minWidth: 32,
    minHeight: 32,
    cursor: 'pointer',
    fontSize: 18,
    lineHeight: 1,
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
  threadTopRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  threadTo: { fontSize: 13, fontWeight: 600, flex: 1 },
  threadSubject: { fontSize: 13, color: '#e2e8f0', marginTop: 2, fontWeight: 600 },
  threadPreview: { fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 1.4 },
  threadDate: { fontSize: 11, color: '#64748b', marginTop: 6 },
  archiveBtn: {
    background: 'transparent',
    border: '1px solid #475569',
    color: '#cbd5e1',
    borderRadius: 6,
    padding: '2px 6px',
    fontSize: 10,
    cursor: 'pointer',
  },
  conversation: {
    flex: 1,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    minWidth: 0,
  },
  outboxToggle: {
    alignSelf: 'flex-start',
    margin: '-4px 0 14px',
  },
  threadTitle: { marginTop: 0 },
  threadToolbar: { display: 'flex', justifyContent: 'flex-end', marginBottom: 16 },
  messages: { display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' },
  messageBubble: { maxWidth: '70%', padding: 12, borderRadius: 10, fontSize: 14 },
  messageMeta: { fontSize: 11, opacity: 0.7, marginBottom: 4 },
  messageBody: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  attachmentList: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  attachmentItem: {
    background: '#e2e8f0',
    color: '#0f172a',
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 600,
  },
  expandBtn: {
    marginTop: 8,
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    padding: 0,
    fontSize: 11,
    cursor: 'pointer',
    opacity: 0.8,
  },
  secondaryBtn: {
    border: '1px solid #cbd5e1',
    background: '#17283b',
    color: '#d7e5f2',
    borderRadius: 8,
    padding: '8px 10px',
    cursor: 'pointer',
  },
  attachmentLink: { color: '#a8d8ff', textDecoration: 'none' },
  downloadLink: { color: '#94a3b8', fontSize: 10, marginLeft: 8 },
};
