import { useEffect, useMemo, useState } from 'react';

// Splits a plain-text email body into what the sender actually wrote and
// the quoted history underneath it (Gmail/Apple Mail "On ... wrote:" chains,
// Outlook "-----Original Message-----" blocks, and lines starting with ">").
function splitEmailBody(text) {
  if (!text) return { main: '', quoted: '' };

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let splitIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();

    if (/^On .{5,120} wrote:$/.test(trimmed)) {
      splitIndex = i;
      break;
    }
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(trimmed)) {
      splitIndex = i;
      break;
    }
    if (/^From:\s.+/.test(trimmed) && lines[i + 1] && /^Sent:\s.+/.test(lines[i + 1].trim())) {
      splitIndex = i;
      break;
    }
    if (trimmed.startsWith('>')) {
      splitIndex = i;
      break;
    }
  }

  if (splitIndex === -1) {
    return { main: text.trim(), quoted: '' };
  }

  return {
    main: lines.slice(0, splitIndex).join('\n').trim(),
    quoted: lines.slice(splitIndex).join('\n').trim(),
  };
}

export default function Inbox() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedMessageIds, setExpandedMessageIds] = useState([]);
  const [quotedVisibleIds, setQuotedVisibleIds] = useState([]);
  const [hiddenThreadIds, setHiddenThreadIds] = useState([]);
  const [unreadThreadIds, setUnreadThreadIds] = useState([]);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/emails?direction=inbound');
    const data = await res.json();
    const loadedEmails = (data.emails || []).map((email) => ({
      ...email,
      attachments: Array.isArray(email.attachments) ? email.attachments : [],
    }));
    setEmails(loadedEmails);
    setUnreadThreadIds([...new Set(loadedEmails.filter((email) => email.direction === 'inbound' && !email.read).map((email) => email.thread_id))]);
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
        .map((msg) => `${msg.from_address || ''} ${msg.subject || ''} ${msg.text_body || ''}`)
        .join(' ')
        .toLowerCase();
      return text.includes(normalized);
    });
  }, [emails, hiddenThreadIds, search]);

  const activeThread = visibleThreads.find((thread) => thread[0].thread_id === selectedThread);
  const lastInbound = activeThread ? [...activeThread].reverse().find((msg) => msg.direction === 'inbound') : null;

  const markThreadRead = (threadId) => {
    setUnreadThreadIds((current) => current.filter((id) => id !== threadId));
  };

  const handleSelectThread = async (threadId) => {
    setSelectedThread(threadId);
    markThreadRead(threadId);
    await fetch(`/api/emails/${threadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    });
  };

  const handleArchiveThread = (threadId) => {
    setHiddenThreadIds((current) => [...current, threadId]);
    if (selectedThread === threadId) setSelectedThread(null);
    setUnreadThreadIds((current) => current.filter((id) => id !== threadId));
  };

  const handleDeleteThread = async (threadId) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this conversation permanently?')) return;

    const res = await fetch(`/api/emails/${threadId}`, { method: 'DELETE' });
    if (!res.ok) {
      setReplyError('Unable to delete this conversation.');
      return;
    }

    setHiddenThreadIds((current) => [...current, threadId]);
    setUnreadThreadIds((current) => current.filter((id) => id !== threadId));
    if (selectedThread === threadId) setSelectedThread(null);
    await load();
  };

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
      if (selectedThread) markThreadRead(selectedThread);
    } catch (error) {
      setReplyError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleReplyAll = () => {
    if (!activeThread) return;
    const recipients = [...new Set(activeThread.map((msg) => msg.from_address).filter(Boolean))];
    const names = recipients.filter((address) => address !== 'You');
    if (!names.length) return;
    const firstName = names[0].split('@')[0] || 'there';
    setReplyText((current) => current || `Hi ${firstName},\n\n`);
    setReplyError('');
  };

  const toggleMessageExpand = (messageId) => {
    setExpandedMessageIds((current) =>
      current.includes(messageId) ? current.filter((id) => id !== messageId) : [...current, messageId]
    );
  };

  const toggleQuotedVisible = (messageId) => {
    setQuotedVisibleIds((current) =>
      current.includes(messageId) ? current.filter((id) => id !== messageId) : [...current, messageId]
    );
  };

  const unreadCount = unreadThreadIds.length;

  return (
    <main className="mail-layout" style={styles.main}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.h2}>Inbox</h2>
          <div style={styles.headerActions}>
            {unreadCount > 0 && <span style={styles.unreadPill}>{unreadCount} unread</span>}
            <button style={styles.refreshBtn} onClick={load}>⟳</button>
          </div>
        </div>

        <div style={styles.searchWrap}>
          <input
            style={styles.searchInput}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sender, subject, or text"
          />
        </div>

        {loading && <p style={styles.dim}>Loading…</p>}
        {!loading && visibleThreads.length === 0 && <p style={styles.dim}>No emails match your search.</p>}

        {visibleThreads.map((thread) => {
          const latest = thread[thread.length - 1];
          const isUnread = latest && latest.direction === 'inbound' && unreadThreadIds.includes(thread[0].thread_id);
          const preview = (latest?.text_body || latest?.subject || '').replace(/\s+/g, ' ').trim();

          return (
            <button
              key={thread[0].thread_id}
              onClick={() => handleSelectThread(thread[0].thread_id)}
              style={{
                ...styles.threadItem,
                background: selectedThread === thread[0].thread_id ? '#1e293b' : 'transparent',
                borderLeft: isUnread ? '3px solid #22c55e' : '3px solid transparent',
              }}
            >
              <div style={styles.threadTopRow}>
                <div style={styles.threadFrom}>{latest.from_address}</div>
                {isUnread && <span style={styles.unreadBadge}>New</span>}
              </div>
              <div style={styles.threadSubject}>{latest.subject || '(no subject)'}</div>
              <div style={styles.threadPreview}>{preview.slice(0, 90)}{preview.length > 90 ? '…' : ''}</div>
              <div style={styles.threadDateRow}>
                <span style={styles.threadDate}>{new Date(latest.received_at).toLocaleString()}</span>
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
            </button>
          );
        })}
      </aside>

      <section style={styles.conversation}>
        {!activeThread && <p style={styles.dim}>Select a conversation.</p>}

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
                const isQuoteVisible = quotedVisibleIds.includes(msg.id);
                const { main, quoted } = splitEmailBody(msg.text_body);
                const content = main || '(no message content)';
                const body = content.length > 300 && !isExpanded ? `${content.slice(0, 300)}…` : content;
                const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];

                return (
                  <div
                    key={msg.id}
                    style={{
                      ...styles.messageBubble,
                      alignSelf: msg.direction === 'outbound' ? 'flex-end' : 'flex-start',
                      background: msg.direction === 'outbound' ? '#173b5f' : '#17283b',
                      color: '#e5eef8',
                    }}
                  >
                    <div style={styles.messageMeta}>
                      {msg.direction === 'outbound' ? 'You' : msg.from_address} ·{' '}
                      {new Date(msg.received_at).toLocaleString()}
                    </div>
                    <div style={styles.messageBody}>{body}</div>
                    {quoted && (
                      <div style={styles.quoteBlock}>
                        <button type="button" style={styles.quoteToggle} onClick={() => toggleQuotedVisible(msg.id)}>
                          {isQuoteVisible ? '▾ Hide quoted text' : '▸ Show quoted text'}
                        </button>
                        {isQuoteVisible && <div style={styles.quotedText}>{quoted}</div>}
                      </div>
                    )}
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

            <div style={styles.replyHeader}>
              <strong>Reply to:</strong> {lastInbound?.from_address || 'selected sender'}
            </div>

            <div style={styles.replyActions}>
              <button type="button" style={styles.secondaryBtn} onClick={handleReplyAll}>
                Reply all
              </button>
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
    gap: 12,
  },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  unreadPill: {
    background: '#dcfce7',
    color: '#166534',
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 700,
  },
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
  threadFrom: { fontSize: 13, fontWeight: 600, flex: 1 },
  unreadBadge: {
    background: '#22c55e',
    color: '#062b13',
    fontSize: 10,
    padding: '3px 6px',
    borderRadius: 999,
    fontWeight: 700,
  },
  threadSubject: { fontSize: 13, color: '#e2e8f0', marginTop: 2, fontWeight: 600 },
  threadPreview: { fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 1.4 },
  threadDateRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8 },
  threadDate: { fontSize: 11, color: '#64748b' },
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
  threadTitle: { marginTop: 0 },
  threadToolbar: { display: 'flex', justifyContent: 'flex-end', marginBottom: 16 },
  messages: { display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' },
  messageBubble: { maxWidth: '70%', padding: 12, borderRadius: 10, fontSize: 14 },
  messageMeta: { fontSize: 11, opacity: 0.7, marginBottom: 4 },
  messageBody: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  quoteBlock: { marginTop: 10 },
  quoteToggle: {
    background: 'transparent',
    border: 'none',
    color: '#8fb3d9',
    padding: 0,
    fontSize: 11,
    cursor: 'pointer',
    opacity: 0.85,
  },
  quotedText: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeft: '2px solid #36536e',
    color: '#9db3c9',
    fontSize: 12.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: 220,
    overflowY: 'auto',
  },
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
  replyHeader: {
    marginTop: 16,
    padding: '8px 10px',
    borderRadius: 8,
    background: '#132337',
    border: '1px solid #29415b',
    color: '#d7e5f2',
    fontSize: 14,
  },
  replyActions: { display: 'flex', justifyContent: 'flex-end', marginTop: 8 },
  secondaryBtn: {
    border: '1px solid #36536e',
    background: '#17283b',
    color: '#d7e5f2',
    borderRadius: 8,
    padding: '8px 10px',
    cursor: 'pointer',
  },
  replyForm: { display: 'flex', gap: 8, marginTop: 12 },
  textarea: {
    flex: 1,
    minHeight: 60,
    padding: 10,
    borderRadius: 8,
    border: '1px solid #36536e',
    background: '#0d1a2a',
    color: '#e5eef8',
    fontFamily: 'inherit',
    fontSize: 14,
    resize: 'vertical',
  },
  sendBtn: {
    padding: '0 20px',
    borderRadius: 8,
    border: 'none',
    background: '#2f8fca',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  replyError: { color: '#fca5a5', fontSize: 13, marginTop: 8, marginBottom: 0 },
  attachmentLink: { color: '#a8d8ff', textDecoration: 'none' },
  downloadLink: { color: '#94a3b8', fontSize: 10, marginLeft: 8 },
};