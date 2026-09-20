import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Composer from '../components/Composer';
import EmptyState from '../components/EmptyState';
import FiltersPopover from '../components/FiltersPopover';
import FolderRail from '../components/FolderRail';
import MailIcon from '../components/MailIcon';
import MailShell from '../components/MailShell';
import MessageCard from '../components/MessageCard';
import BulkBar from '../components/BulkBar';
import ThreadHeader from '../components/ThreadHeader';
import ThreadList from '../components/ThreadList';
import useMailbox from '../hooks/useMailbox';

export default function Inbox() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState('');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [density, setDensity] = useState('comfortable');
  const [composerOpen, setComposerOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState({ text: '', html: '', cc: '', bcc: '', mode: 'reply', attachments: [] });
  const [replyDraftId, setReplyDraftId] = useState(null);
  const [replyError, setReplyError] = useState('');
  const [sending, setSending] = useState(false);
  const [noteText, setNoteText] = useState('');
  const selectedThread = typeof router.query.thread === 'string' ? router.query.thread : null;
  const mailbox = useMailbox({
    mode: 'inbox',
    currentUser,
    selectedThread,
    onSelectedThreadChange: (threadId) => router.push(threadId ? { pathname: '/inbox', query: { thread: threadId } } : '/inbox', undefined, { shallow: true }),
  });

  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem('email_session') || '{}');
      setCurrentUser(session.email || '');
      setRailCollapsed(localStorage.getItem('mail_rail_collapsed') === 'true');
    } catch (error) {
      setCurrentUser('');
    }
  }, []);

  useEffect(() => {
    if (!selectedThread) {
      setReplyDraft({ text: '', html: '', cc: '', bcc: '', mode: 'reply', attachments: [] });
      setReplyDraftId(null);
      return;
    }
    fetch(`/api/drafts?threadId=${encodeURIComponent(selectedThread)}`)
      .then((response) => response.ok ? response.json() : { drafts: [] })
      .then((data) => {
        const draft = data.drafts?.find((item) => item.kind === 'reply' || item.kind === 'forward');
        if (draft) {
          setReplyDraftId(draft.id);
          setReplyDraft({ text: draft.text_body || '', html: draft.html_body || '', cc: draft.cc || '', bcc: draft.bcc || '', mode: draft.kind, attachments: draft.attachments || [] });
        } else {
          setReplyDraftId(null);
          setReplyDraft({ text: '', html: '', cc: '', bcc: '', mode: 'reply', attachments: [] });
        }
      })
      .catch(() => {});
  }, [selectedThread]);

  useEffect(() => {
    if (!selectedThread || (!replyDraft.text && !replyDraft.cc && !replyDraft.bcc)) return undefined;
    const timeout = setTimeout(() => {
      fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: replyDraftId, kind: replyDraft.mode, threadId: selectedThread, message: replyDraft.text, html: replyDraft.html, cc: replyDraft.cc, bcc: replyDraft.bcc, attachments: replyDraft.attachments }),
      }).then((response) => response.ok ? response.json() : null).then((data) => {
        if (data?.draft?.id) setReplyDraftId(data.draft.id);
      });
    }, 1500);
    return () => clearTimeout(timeout);
  }, [replyDraft, replyDraftId, selectedThread]);

  useEffect(() => {
    const handleKeyboard = (event) => {
      if (event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
      const ids = mailbox.threads.map((thread) => thread[0].thread_id);
      if (event.key === 'Escape') { setFiltersOpen(false); setDrawerOpen(false); if (selectedThread) mailbox.setSelectedThread(null); }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const currentIndex = ids.indexOf(selectedThread);
      const nextIndex = event.key === 'ArrowDown' ? Math.min(currentIndex + 1, ids.length - 1) : Math.max(currentIndex - 1, 0);
      if (ids[nextIndex]) mailbox.selectThread(ids[nextIndex]);
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [mailbox, selectedThread]);

  const folders = useMemo(() => [
    { value: 'inbox', label: 'Inbox', count: mailbox.unreadCount },
    { value: 'starred', label: 'Starred' },
    { value: 'sent', label: 'Sent' },
    { value: 'drafts', label: 'Drafts' },
    { value: 'archive', label: 'Archive' },
    { value: 'spam', label: 'Spam' },
    { value: 'all', label: 'All mail' },
  ], [mailbox.unreadCount]);

  const activeMessage = mailbox.activeThread ? [...mailbox.activeThread].reverse().find((message) => message.direction === 'inbound') : null;

  const handleRailToggle = () => setRailCollapsed((value) => {
    const next = !value;
    try { localStorage.setItem('mail_rail_collapsed', String(next)); } catch (error) {}
    return next;
  });

  const handleFiltersApply = () => mailbox.load({ filters: mailbox.filters });
  const handleFiltersClear = () => {
    const next = { dateFrom: '', dateTo: '', senderDomain: '', read: '' };
    mailbox.setFilters(next);
    mailbox.setSearch('');
    mailbox.load({ filters: next });
  };
  const handleSelectAll = () => mailbox.setSelectedThreadIds(mailbox.selectedThreadIds.length === mailbox.threads.length ? [] : mailbox.threads.map((thread) => thread[0].thread_id));
  const handleThreadAction = (action) => {
    if (action === 'delete') mailbox.deleteThread(selectedThread);
    if (action === 'archive') mailbox.bulkAction('archive', [selectedThread]);
    if (action === 'release') mailbox.releaseThread();
  };

  const handleReply = async ({ message, html, cc, bcc }) => {
    if (!activeMessage) return;
    setReplyError('');
    setSending(true);
    const response = await fetch('/api/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: activeMessage.thread_id, to: activeMessage.from_address, from: activeMessage.to_address, subject: activeMessage.subject, message, html, cc, bcc, attachments: replyDraft.attachments, action: replyDraft.mode, inReplyToMessageId: activeMessage.message_id, claimedBy: currentUser }),
    });
    const data = await response.json();
    if (!response.ok) setReplyError(data.error || 'Unable to send the reply.');
    else {
      setReplyDraft({ text: '', html: '', cc: '', bcc: '', mode: 'reply', attachments: [] });
      setReplyDraftId(null);
      setComposerOpen(false);
      await mailbox.load();
    }
    setSending(false);
  };

  const handleReplyAll = () => {
    if (!mailbox.activeThread || !activeMessage) return;
    const recipients = [...new Set(mailbox.activeThread.map((message) => message.from_address).filter(Boolean))];
    const firstName = activeMessage.from_address.split('@')[0] || 'there';
    setReplyDraft((current) => ({ ...current, text: current.text || `Hi ${firstName},\n\n`, cc: recipients.filter((address) => address !== activeMessage.from_address).join(', '), mode: 'reply' }));
    setComposerOpen(true);
  };

  const handleForward = () => {
    const latest = mailbox.activeThread?.[mailbox.activeThread.length - 1];
    if (!latest) return;
    setReplyDraft({ text: `\n\n---------- Forwarded message ----------\nFrom: ${latest.from_address}\nSubject: ${latest.subject}\n\n${latest.text_body || ''}`, html: `<p><br><br>---------- Forwarded message ----------<br>From: ${escapeHtml(latest.from_address)}<br>Subject: ${escapeHtml(latest.subject)}<br><br>${escapeHtml(latest.text_body || '').replace(/\n/g, '<br>')}</p>`, cc: '', bcc: '', mode: 'forward', attachments: latest.attachments || [] });
    setComposerOpen(true);
  };

  const handleCanned = (id, setText) => {
    const response = mailbox.cannedResponses.find((item) => item.id === id);
    if (!response) return;
    const variables = { customer_name: activeMessage?.from_address?.split('@')[0], agent_name: currentUser?.split('@')[0], thread_subject: mailbox.activeThread?.[0]?.subject };
    setText(response.body.replace(/\{\{\s*(customer_name|agent_name|thread_subject)\s*\}\}/gi, (match, key) => variables[key.toLowerCase()] || match));
  };

  const rail = <FolderRail folders={folders} mailboxes={mailbox.mailboxGroups} selectedFolder={mailbox.selectedFolder} selectedMailbox={mailbox.selectedMailbox} onFolder={(folder) => { mailbox.setSelectedFolder(folder); setDrawerOpen(false); }} onMailbox={(value) => { mailbox.setSelectedMailbox(value); setDrawerOpen(false); }} collapsed={railCollapsed} onToggle={handleRailToggle} />;
  const list = <section className="mail-list-pane"><header className="mail-list-header">{mailbox.selectedThreadIds.length ? <BulkBar selectedCount={mailbox.selectedThreadIds.length} allSelected={mailbox.selectedThreadIds.length === mailbox.threads.length} onSelectAll={handleSelectAll} onAction={(action) => mailbox.bulkAction(action)} /> : <><div className="mail-list-tools"><button className="mail-icon-button mail-mobile-only" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open folders"><MailIcon name="menu" /></button><div className="mail-search"><input className="mail-input" value={mailbox.search} onChange={(event) => mailbox.setSearch(event.target.value)} placeholder="Search sender, subject, or text" aria-label="Search messages" /></div><button className="mail-button" type="button" onClick={() => setFiltersOpen((value) => !value)}><MailIcon name="filter" size={15} /> Filters{mailbox.filterCount > 0 && <span className="mail-count">{mailbox.filterCount}</span>}</button><button className="mail-icon-button" type="button" onClick={() => mailbox.load()} aria-label="Refresh messages" title="Refresh"><MailIcon name="refresh" /></button></div><div className="mail-filter-tools"><span className="mail-count">{mailbox.threads.length} conversations</span><div className="mail-density"><button type="button" aria-pressed={density === 'comfortable'} onClick={() => setDensity('comfortable')}>Comfort</button><button type="button" aria-pressed={density === 'compact'} onClick={() => setDensity('compact')}>Compact</button></div></div>{filtersOpen && <FiltersPopover filters={mailbox.filters} onChange={mailbox.setFilters} onApply={handleFiltersApply} onClear={handleFiltersClear} onClose={() => setFiltersOpen(false)} />}</>}</header>{mailbox.actionError && <p className="mail-error" aria-live="polite">{mailbox.actionError}</p>}<ThreadList threads={mailbox.threads} loading={mailbox.loading} selectedThread={selectedThread} unreadThreadIds={mailbox.unreadThreadIds} selectedThreadIds={mailbox.selectedThreadIds} compact={density === 'compact'} onSelect={mailbox.selectThread} onToggleSelected={(id) => mailbox.setSelectedThreadIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])} onStar={mailbox.starThread} onQuickAction={(action, id) => mailbox.bulkAction(action, [id])} folder={mailbox.selectedFolder} /></section>;

  const reading = mailbox.activeThread ? <section className="mail-reading-pane"><ThreadHeader subject={mailbox.activeThread[0].subject} label={mailbox.activeThread[0].label} status={mailbox.activeThread[0].status} claimedBy={mailbox.activeThread[0].claimed_by} activityCount={mailbox.threadActivity.length} onBack={() => mailbox.setSelectedThread(null)} onAction={handleThreadAction} onStatusChange={mailbox.updateStatus} canRelease={mailbox.activeThread[0].claimed_by === currentUser} /><div className="mail-thread-body"><details className="mail-activity"><summary>Activity ({mailbox.threadActivity.length})</summary><div className="mail-activity-list">{mailbox.threadActivity.map((activity) => <div className="mail-activity-row" key={activity.id}><span>{activity.actor_email} · {activity.activity_type}</span><time>{new Date(activity.created_at).toLocaleString()}</time></div>)}</div></details>{mailbox.threadNotes.length > 0 && <details className="mail-activity"><summary>Private notes ({mailbox.threadNotes.length})</summary><div className="mail-activity-list">{mailbox.threadNotes.map((note) => <div className="mail-activity-row" key={note.id}><span>{note.body}</span><time>{new Date(note.created_at).toLocaleString()}</time></div>)}</div></details>}{mailbox.activeThread.map((message, index) => <MessageCard key={message.id} message={message} isNewest={index === mailbox.activeThread.length - 1} splitBody={splitEmailBody} attachmentHref={(id, attachmentIndex, download) => `/api/emails/${id}/attachment?index=${attachmentIndex}${download ? '&download=1' : ''}`} />)}<form className="mail-note-form" onSubmit={(event) => { event.preventDefault(); mailbox.addNote(noteText); setNoteText(''); }}><input className="mail-input" value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Private note or @mention" aria-label="Private note" /><button className="mail-button" type="submit">Add note</button></form></div><div className="mail-composer"><div className="mail-composer-row"><button className="mail-button" type="button" onClick={handleReplyAll} disabled={!activeMessage}>Reply all</button><button className="mail-button" type="button" onClick={handleForward}>Forward</button></div><Composer open={composerOpen} onOpen={() => setComposerOpen((value) => !value)} onSubmit={handleReply} sending={sending} error={replyError || mailbox.claimError} cannedResponses={mailbox.cannedResponses} onCannedResponse={handleCanned} draft={replyDraft} onDraftChange={setReplyDraft} /></div></section> : <section className="mail-reading-pane"><EmptyState title="Select a conversation" message="Choose a thread from the list to read and reply." icon="mail" /></section>;

  return <MailShell collapsed={railCollapsed} drawerOpen={drawerOpen} threadOpen={Boolean(selectedThread)} onMenu={() => setDrawerOpen((value) => !value)} onCompose={() => router.push('/')} rail={rail} list={list} reading={reading} />;
}

function escapeHtml(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function splitEmailBody(text) {
  if (!text) return { main: '', quoted: '' };
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const index = lines.findIndex((line, position) => /^On .{5,120} wrote:$/.test(line.trim()) || /^-{2,}\s*Original Message\s*-{2,}$/i.test(line.trim()) || (line.trim().startsWith('>') && position > 0));
  return index === -1 ? { main: text.trim(), quoted: '' } : { main: lines.slice(0, index).join('\n').trim(), quoted: lines.slice(index).join('\n').trim() };
}
