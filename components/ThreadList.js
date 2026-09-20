import { groupByDate } from '../lib/mailbox';
import ThreadRow from './ThreadRow';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';

export default function ThreadList({ threads, loading, selectedThread, unreadThreadIds, selectedThreadIds, compact, onSelect, onToggleSelected, onStar, onQuickAction, folder }) {
  if (loading) return <div className="mail-list-scroll"><Skeleton /></div>;
  if (!threads.length) return <div className="mail-list-scroll"><EmptyState title={`Nothing in ${folder}`} message="Try another folder or clear your filters." icon={folder === 'spam' ? 'mail' : 'inbox'} /></div>;
  const groups = groupByDate(threads, (thread) => thread[thread.length - 1]?.received_at);
  return <div className="mail-list-scroll">{Object.entries(groups).map(([label, groupedThreads]) => { if (!groupedThreads.length) return null; const ids = new Set(groupedThreads.map((thread) => thread[0].thread_id)); return <section key={label}><h2 className="mail-date-heading">{label}</h2>{threads.filter((thread) => ids.has(thread[0].thread_id)).map((thread) => <ThreadRow key={thread[0].thread_id} thread={thread} selected={selectedThread === thread[0].thread_id} unread={unreadThreadIds.includes(thread[0].thread_id)} compact={compact} selectedForBulk={selectedThreadIds.includes(thread[0].thread_id)} onSelect={onSelect} onToggleSelected={onToggleSelected} onStar={onStar} onQuickAction={onQuickAction} />)}</section>; })}</div>;
}
