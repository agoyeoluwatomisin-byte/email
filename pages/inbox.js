import { useEffect, useMemo, useState } from 'react';

function formatMailboxLabel(address) {
  if (!address) return 'unknown';
  const clean = address.trim();
  if (!clean) return 'unknown';
  const localPart = clean.split('@')[0];
  return (localPart || clean).toLowerCase();
}

function parseMailboxAddresses(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[;,]/);

  return values
    .map((item) => {
      const match = String(item).match(/<([^>]+)>/);
      return (match ? match[1] : String(item)).trim().toLowerCase();
    })
    .map((address) => address.replace(/^mailto:/, '').replace(/[\s"']/g, ''))
    .filter((address) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address));
}

function getFileIcon(attachment) {
  const type = String(attachment.mimeType || attachment.contentType || '').toLowerCase();
  if (type.startsWith('image/')) return 'IMG';
  if (type.includes('pdf')) return 'PDF';
  if (type.includes('word') || type.includes('document')) return 'DOC';
  if (type.includes('sheet') || type.includes('excel')) return 'XLS';
  if (type.includes('zip') || type.includes('compressed')) return 'ZIP';
  return 'FILE';
}

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
  const [selectedMailbox, setSelectedMailbox] = useState('all');
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedThreadIds, setSelectedThreadIds] = useState([]);
  const [actionError, setActionError] = useState('');
  const [expandedMessageIds, setExpandedMessageIds] = useState([]);
  const [hiddenThreadIds, setHiddenThreadIds] = useState([]);
  const [unreadThreadIds, setUnreadThreadIds] = useState([]);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/emails');
    const data = await res.json();
    const loadedEmails = (data.emails || []).map((email) => ({
      ...email,
      mailboxAddresses: parseMailboxAddresses(email.to_address),
      attachments: Array.isArray(email.attachments) ? email.attachments : [],
    }));
    setEmails(loadedEmails);
    setUnreadThreadIds([...new Set(loadedEmails.filter((email) => email.direction === 'inbound' && !email.read).map((email) => email.thread_id))]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const mailboxGroups = useMemo(() => {
    const addresses = [...new Set(emails.flatMap((email) => email.mailboxAddresses || parseMailboxAddresses(email.to_address)))];
    const localPartCounts = addresses.reduce((counts, address) => {
      const localPart = formatMailboxLabel(address);
      counts[localPart] = (counts[localPart] || 0) + 1;
      return counts;
    }, {});

    return addresses
      .map((address) => {
        const localPart = formatMailboxLabel(address);
        const domain = address.split('@')[1] || '';
        return {
          value: address,
          label: localPartCounts[localPart] > 1 ? `${localPart}@${domain}` : localPart,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [emails]);

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

    const filteredByFolder = selectedFolder === 'all'
      ? grouped
      : selectedFolder === 'starred'
        ? grouped.filter((thread) => thread.some((msg) => msg.starred))
        : grouped.filter((thread) => (thread[0].folder || (thread[0].direction === 'outbound' ? 'sent' : 'inbox')) === selectedFolder);

    const filteredByMailbox = selectedMailbox === 'all'
      ? filteredByFolder
      : filteredByFolder.filter((thread) => {
          const recipients = [...new Set(thread.flatMap((msg) => msg.mailboxAddresses || parseMailboxAddresses(msg.to_address)))];
          return recipients.includes(selectedMailbox);
        });

    const normalized = search.trim().toLowerCase();
    if (!normalized) return filteredByMailbox;

    return filteredByMailbox.filter((thread) => {
      const text = thread
        .map((msg) => `${msg.from_address || ''} ${msg.subject || ''} ${msg.text_body || ''} ${msg.to_address || ''}`)
        .join(' ')
        .toLowerCase();
      return text.includes(normalized);
    });
  }, [emails, hiddenThreadIds, search, selectedFolder, selectedMailbox]);

  useEffect(() => {
    if (selectedMailbox !== 'all' && !mailboxGroups.some((item) => item.value === selectedMailbox)) {
      setSelectedMailbox('all');
    }
  }, [mailboxGroups, selectedMailbox]);

  useEffect(() => {
    if (selectedThread && !visibleThreads.some((thread) => thread[0].thread_id === selectedThread)) {
      setSelectedThread(null);
    }
  }, [selectedThread, visibleThreads]);

  const activeThread = visibleThreads.find((thread) => thread[0].thread_id === selectedThread);
  const lastInbound = activeThread ? [...activeThread].reverse().find((msg) => msg.direction === 'inbound') : null;

  const markThreadRead = (threadId) => {
    setUnreadThreadIds((current) => current.filter((id) => id !== threadId));
  };

  const handleSelectThread = async (threadId) => {
    setSelectedThread(threadId);
    setIsSidebarOpen(false);
    markThreadRead(threadId);
    await fetch(`/api/emails/${threadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    });
  };

  const handleArchiveThread = (threadId) => {
    handleBulkAction('archive', [threadId]);
  };

  const handleBulkAction = async (action, ids = selectedThreadIds) => {
    if (!ids.length) return;
    setActionError('');
    const res = await fetch('/api/emails/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadIds: ids, action }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error || 'Unable to update selected messages.');
      return;
    }

    setSelectedThreadIds((current) => current.filter((id) => !ids.includes(id)));
    await load();
  };

  const handleBulkDelete = async () => {
    if (!selectedThreadIds.length) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${selectedThreadIds.length} conversation(s) permanently?`)) return;

    const res = await fetch('/api/emails/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadIds: selectedThreadIds, action: 'delete' }),
    });

    if (!res.ok) {
      setActionError('Unable to delete selected messages.');
      return;
    }

    setSelectedThreadIds([]);
    setSelectedThread(null);
    await load();
  };

  const toggleThreadSelection = (threadId) => {
    setSelectedThreadIds((current) => current.includes(threadId) ? current.filter((id) => id !== threadId) : [...current, threadId]);
  };

  const toggleThreadStar = async (threadId, starred) => {
    await fetch(`/api/emails/${threadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred: !starred }),
    });
    await load();
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

  const unreadCount = unreadThreadIds.length;
  const folderFilters = [
    { value: 'inbox', label: 'Inbox' },
    { value: 'starred', label: 'Starred' },
    { value: 'archive', label: 'Archive' },
    { value: 'spam', label: 'Spam' },
    { value: 'drafts', label: 'Drafts' },
    { value: 'sent', label: 'Sent' },
    { value: 'all', label: 'All mail' },
  ];

  return (
    <main className="mail-layout" data-sidebar-open={isSidebarOpen ? 'true' : 'false'} style={styles.main}>
      <aside className={isSidebarOpen ? 'mail-sidebar-open' : 'mail-sidebar-closed'} style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.h2}>Inbox</h2>
          <div style={styles.headerActions}>
            {unreadCount > 0 && <span style={styles.unreadPill}>{unreadCount} unread</span>}
            <button style={styles.refreshBtn} onClick={load}>⟳</button>
            <button
              type="button"
              className="mobile-sidebar-toggle"
              style={styles.sidebarToggle}
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Hide inbox list"
            >
              ×
            </button>
          </div>
        </div>

        <div style={styles.folderWrap}>
          {folderFilters.map((folder) => (
            <button
              key={folder.value}
              type="button"
              onClick={() => setSelectedFolder(folder.value)}
              style={{ ...styles.filterButton, ...(selectedFolder === folder.value ? styles.filterButtonActive : {}) }}
            >
              {folder.label}
            </button>
          ))}
        </div>

        <div style={styles.filterWrap}>
          <button
            type="button"
            onClick={() => setSelectedMailbox('all')}
            style={{
              ...styles.filterButton,
              ...(selectedMailbox === 'all' ? styles.filterButtonActive : {}),
            }}
          >
            All inbox
          </button>
          {mailboxGroups.map((mailbox) => (
            <button
              key={mailbox.value}
              type="button"
              onClick={() => setSelectedMailbox(mailbox.value)}
              style={{
                ...styles.filterButton,
                ...(selectedMailbox === mailbox.value ? styles.filterButtonActive : {}),
              }}
            >
              {mailbox.label}
            </button>
          ))}
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

        {selectedThreadIds.length > 0 && (
          <div style={styles.bulkToolbar}>
            <strong>{selectedThreadIds.length} selected</strong>
            <button type="button" style={styles.bulkButton} onClick={() => handleBulkAction('read')}>Read</button>
            <button type="button" style={styles.bulkButton} onClick={() => handleBulkAction('star')}>Star</button>
            <button type="button" style={styles.bulkButton} onClick={() => handleBulkAction('archive')}>Archive</button>
            <button type="button" style={styles.bulkButton} onClick={() => handleBulkAction('spam')}>Spam</button>
            <button type="button" style={styles.bulkDeleteButton} onClick={handleBulkDelete}>Delete</button>
          </div>
        )}
        {actionError && <p style={styles.actionError}>{actionError}</p>}

        {loading ? (
          <div style={styles.skeletonList}>
            {[1, 2, 3].map((item) => (
              <div key={item} style={styles.skeletonRow} />
            ))}
          </div>
        ) : visibleThreads.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyTitle}>No messages in this inbox</div>
            <p style={styles.emptyText}>Try another mailbox group or clear your search.</p>
            <button type="button" style={styles.emptyAction} onClick={() => { setSearch(''); setSelectedMailbox('all'); setSelectedFolder('all'); }}>
              Show all inboxes
            </button>
          </div>
        ) : null}

        {visibleThreads.map((thread) => {
          const latest = thread[thread.length - 1];
          const isUnread = latest && latest.direction === 'inbound' && unreadThreadIds.includes(thread[0].thread_id);
          const preview = (splitEmailBody(latest?.text_body).main || latest?.subject || '').replace(/\s+/g, ' ').trim();

          const isStarred = thread.some((msg) => msg.starred);

          return (
            <div
              key={thread[0].thread_id}
              onClick={() => handleSelectThread(thread[0].thread_id)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') handleSelectThread(thread[0].thread_id); }}
              role="button"
              tabIndex={0}
              style={{
                ...styles.threadItem,
                background: selectedThread === thread[0].thread_id ? '#1e293b' : 'transparent',
                borderLeft: isUnread ? '3px solid #22c55e' : '3px solid transparent',
              }}
            >
              <div style={styles.threadTopRow}>
                <input
                  type="checkbox"
                  checked={selectedThreadIds.includes(thread[0].thread_id)}
                  onChange={() => toggleThreadSelection(thread[0].thread_id)}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`Select ${latest.subject || 'conversation'}`}
                />
                <div style={styles.threadFrom}>{latest.from_address}</div>
                {isUnread && <span style={styles.unreadBadge}>New</span>}
                <button type="button" style={styles.starButton} onClick={(event) => { event.stopPropagation(); toggleThreadStar(thread[0].thread_id, isStarred); }} aria-label={isStarred ? 'Unstar conversation' : 'Star conversation'}>
                  {isStarred ? '★' : '☆'}
                </button>
              </div>
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
            </div>
          );
        })}
      </aside>

      <section className="mail-conversation" style={styles.conversation}>
        <button
          type="button"
          className="mobile-sidebar-toggle mobile-inbox-toggle"
          style={styles.inboxToggle}
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Show inbox list"
        >
          ‹ Inbox
        </button>
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
                const { main } = splitEmailBody(msg.text_body);
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
                    {attachments.length > 0 && (
                      <div style={styles.attachmentList}>
                        {attachments.map((attachment, index) => (
                          <div key={`${attachment.filename || attachment.name || 'file'}-${index}`} style={styles.attachmentItem}>
                            {String(attachment.mimeType || attachment.contentType || '').startsWith('image/') && attachment.content && (
                              <img src={`/api/emails/${msg.id}/attachment?index=${index}`} alt={attachment.filename || attachment.name || 'Attachment'} style={styles.attachmentPreview} />
                            )}
                            <span style={styles.fileIcon}>{getFileIcon(attachment)}</span>
                            <span>{attachment.filename || attachment.name || 'Attachment'}</span>
                            <a href={`/api/emails/${msg.id}/attachment?index=${index}`} target="_blank" rel="noreferrer" style={styles.attachmentLink}>Open</a>
                            {attachment.content && <a href={`/api/emails/${msg.id}/attachment?index=${index}&download=1`} style={styles.downloadLink}>Download</a>}
                          </div>
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
  folderWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: '0 16px 12px',
    borderBottom: '1px solid #1e293b',
  },
  filterWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: '0 16px 12px',
  },
  bulkToolbar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    padding: '0 16px 12px',
    color: '#cbd5e1',
    fontSize: 11,
  },
  bulkButton: {
    background: '#17283b',
    border: '1px solid #36536e',
    color: '#d7e5f2',
    borderRadius: 6,
    padding: '5px 7px',
    cursor: 'pointer',
    fontSize: 11,
  },
  bulkDeleteButton: {
    background: '#7f1d1d',
    border: '1px solid #b91c1c',
    color: '#fee2e2',
    borderRadius: 6,
    padding: '5px 7px',
    cursor: 'pointer',
    fontSize: 11,
  },
  actionError: { color: '#fca5a5', padding: '0 16px', fontSize: 12 },
  filterButton: {
    background: '#111827',
    border: '1px solid #334155',
    color: '#cbd5e1',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  filterButtonActive: {
    background: '#2563eb',
    borderColor: '#2563eb',
    color: '#eff6ff',
  },
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
  skeletonList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '0 16px 16px',
  },
  skeletonRow: {
    height: 72,
    borderRadius: 12,
    background: 'linear-gradient(90deg, rgba(51,65,85,0.7) 25%, rgba(30,41,59,0.9) 50%, rgba(51,65,85,0.7) 75%)',
    backgroundSize: '200% 100%',
    animation: 'pulse 1.2s ease-in-out infinite',
  },
  emptyState: {
    padding: '24px 16px',
    color: '#cbd5e1',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 6,
  },
  emptyText: {
    margin: '0 0 12px',
    color: '#94a3b8',
    fontSize: 13,
  },
  emptyAction: {
    background: '#2563eb',
    border: 'none',
    borderRadius: 8,
    color: '#eff6ff',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 700,
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
    starButton: {
      background: 'transparent',
      border: 'none',
      color: '#fbbf24',
      fontSize: 18,
      lineHeight: 1,
      padding: 0,
      cursor: 'pointer',
    },
  threadFrom: { fontSize: 13, fontWeight: 600, flex: 1 },
  unreadBadge: {
    background: '#22c55e',
    color: '#062b13',
    fontSize: 10,
    padding: '3px 6px',
    borderRadius: 999,
    fontWeight: 700,
  },
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
  attachmentList: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  attachmentItem: {
    background: '#e2e8f0',
    color: '#0f172a',
    borderRadius: 8,
    padding: '6px 8px',
    fontSize: 11,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  attachmentPreview: {
    display: 'block',
    width: 120,
    maxHeight: 100,
    objectFit: 'cover',
    borderRadius: 6,
    flexBasis: '100%',
  },
  fileIcon: {
    background: '#cbd5e1',
    borderRadius: 4,
    padding: '2px 4px',
    fontSize: 9,
    color: '#334155',
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