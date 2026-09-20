import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import EmptyState from '../components/EmptyState';
import FolderRail from '../components/FolderRail';
import MailIcon from '../components/MailIcon';
import MailShell from '../components/MailShell';
import MessageCard from '../components/MessageCard';
import ThreadHeader from '../components/ThreadHeader';
import ThreadList from '../components/ThreadList';
import useMailbox from '../hooks/useMailbox';

export default function Outbox() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState('');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [density, setDensity] = useState('comfortable');
  const selectedThread = typeof router.query.thread === 'string' ? router.query.thread : null;
  const mailbox = useMailbox({ mode: 'outbox', currentUser, selectedThread, onSelectedThreadChange: (threadId) => router.push(threadId ? { pathname: '/outbox', query: { thread: threadId } } : '/outbox', undefined, { shallow: true }) });

  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem('email_session') || '{}');
      setCurrentUser(session.email || '');
      setRailCollapsed(localStorage.getItem('mail_rail_collapsed') === 'true');
    } catch (error) { setCurrentUser(''); }
  }, []);

  useEffect(() => {
    const handleKeyboard = (event) => {
      if (event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
      const ids = mailbox.threads.map((thread) => thread[0].thread_id);
      if (event.key === 'Escape' && selectedThread) mailbox.setSelectedThread(null);
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
    { value: 'inbox', label: 'Inbox' },
    { value: 'starred', label: 'Starred' },
    { value: 'sent', label: 'Sent' },
    { value: 'drafts', label: 'Drafts' },
    { value: 'archive', label: 'Archive' },
    { value: 'spam', label: 'Spam' },
    { value: 'all', label: 'All mail' },
  ], []);

  const handleRailToggle = () => setRailCollapsed((value) => {
    const next = !value;
    try { localStorage.setItem('mail_rail_collapsed', String(next)); } catch (error) {}
    return next;
  });
  const handleThreadAction = (action) => {
    if (action === 'delete') mailbox.deleteThread(selectedThread);
    if (action === 'archive') mailbox.bulkAction('archive', [selectedThread]);
  };

  const rail = <FolderRail folders={folders} mailboxes={mailbox.mailboxGroups} selectedFolder="sent" selectedMailbox={mailbox.selectedMailbox} onFolder={(folder) => { if (folder === 'sent') return; router.push(`/inbox?folder=${encodeURIComponent(folder)}`); }} onMailbox={mailbox.setSelectedMailbox} collapsed={railCollapsed} onToggle={handleRailToggle} />;
  const list = <section className="mail-list-pane"><header className="mail-list-header"><div className="mail-list-tools"><button className="mail-icon-button mail-mobile-only" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open folders"><MailIcon name="menu" /></button><div className="mail-search"><input className="mail-input" value={mailbox.search} onChange={(event) => mailbox.setSearch(event.target.value)} placeholder="Search recipient or subject" aria-label="Search sent messages" /></div><button className="mail-icon-button" type="button" onClick={() => mailbox.load()} aria-label="Refresh sent messages"><MailIcon name="refresh" /></button></div><div className="mail-filter-tools"><span className="mail-count">{mailbox.threads.length} sent conversations</span><div className="mail-density"><button type="button" aria-pressed={density === 'comfortable'} onClick={() => setDensity('comfortable')}>Comfort</button><button type="button" aria-pressed={density === 'compact'} onClick={() => setDensity('compact')}>Compact</button></div></div></header><ThreadList threads={mailbox.threads} loading={mailbox.loading} selectedThread={selectedThread} unreadThreadIds={[]} selectedThreadIds={[]} compact={density === 'compact'} onSelect={mailbox.selectThread} onToggleSelected={() => {}} onStar={mailbox.starThread} onQuickAction={(action, id) => mailbox.bulkAction(action, [id])} folder="sent" /></section>;
  const reading = mailbox.activeThread ? <section className="mail-reading-pane"><ThreadHeader subject={mailbox.activeThread[0].subject} label="sent" status={mailbox.activeThread[0].deliveryStatus || 'sent'} claimedBy={null} activityCount={0} onBack={() => mailbox.setSelectedThread(null)} onAction={handleThreadAction} onStatusChange={() => {}} canRelease={false} /><div className="mail-thread-body">{mailbox.activeThread.map((message, index) => <MessageCard key={message.id} message={message} isNewest={index === mailbox.activeThread.length - 1} splitBody={splitEmailBody} attachmentHref={(id, attachmentIndex, download) => `/api/emails/${id}/attachment?index=${attachmentIndex}${download ? '&download=1' : ''}`} />)}</div></section> : <section className="mail-reading-pane"><EmptyState title="Select a sent conversation" message="Choose a message from the list to inspect it." icon="send" /></section>;

  return <MailShell collapsed={railCollapsed} drawerOpen={drawerOpen} threadOpen={Boolean(selectedThread)} onMenu={() => setDrawerOpen((value) => !value)} rail={rail} list={list} reading={reading} />;
}

function splitEmailBody(text) {
  if (!text) return { main: '', quoted: '' };
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const index = lines.findIndex((line, position) => /^On .{5,120} wrote:$/.test(line.trim()) || /^-{2,}\s*Original Message\s*-{2,}$/i.test(line.trim()) || (line.trim().startsWith('>') && position > 0));
  return index === -1 ? { main: text.trim(), quoted: '' } : { main: lines.slice(0, index).join('\n').trim(), quoted: lines.slice(index).join('\n').trim() };
}
