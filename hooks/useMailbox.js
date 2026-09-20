import { useCallback, useEffect, useMemo, useState } from 'react';

export default function useMailbox({ mode = 'inbox', currentUser = '', selectedThread: controlledThread, onSelectedThreadChange }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', senderDomain: '', read: '' });
  const [selectedMailbox, setSelectedMailbox] = useState('all');
  const [selectedFolder, setSelectedFolder] = useState(mode === 'outbox' ? 'sent' : 'inbox');
  const [selectedThreadIds, setSelectedThreadIds] = useState([]);
  const [unreadThreadIds, setUnreadThreadIds] = useState([]);
  const [actionError, setActionError] = useState('');
  const [claimError, setClaimError] = useState('');
  const [threadActivity, setThreadActivity] = useState([]);
  const [threadNotes, setThreadNotes] = useState([]);
  const [cannedResponses, setCannedResponses] = useState([]);
  const selectedThread = controlledThread;

  const setSelectedThread = useCallback((threadId) => onSelectedThreadChange?.(threadId), [onSelectedThreadChange]);

  const load = useCallback(async (override = {}) => {
    setLoading(true);
    const folder = override.folder ?? selectedFolder;
    const query = new URLSearchParams();
    if (mode === 'outbox') query.set('direction', 'outbound');
    if (folder !== 'all' && folder !== 'starred' && folder !== 'sent') query.set('folder', folder);
    if (folder === 'starred') query.set('starred', 'true');
    if (activeSearch.trim()) query.set('search', activeSearch.trim());
    const currentFilters = override.filters || filters;
    if (currentFilters.dateFrom) query.set('fromDate', currentFilters.dateFrom);
    if (currentFilters.dateTo) query.set('toDate', currentFilters.dateTo);
    if (currentFilters.senderDomain.trim()) query.set('senderDomain', currentFilters.senderDomain.trim());
    if (currentFilters.read) query.set('read', currentFilters.read);
    const response = await fetch(`/api/emails?${query.toString()}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setEmails([]);
      setUnreadThreadIds([]);
      setActionError(data.error || `Unable to load messages (${response.status}).`);
      setLoading(false);
      return;
    }
    setActionError('');
    const loadedEmails = (data.emails || []).map((email) => ({ ...email, label: email.label || 'other', mailboxAddresses: parseMailboxAddresses(email.to_address), attachments: Array.isArray(email.attachments) ? email.attachments : [] }));
    if (mode === 'inbox') {
      const threadResponse = await fetch('/api/threads');
      if (threadResponse.ok) {
        const threadData = await threadResponse.json();
        const state = new Map((threadData.threads || []).map((thread) => [thread.threadId, thread]));
        loadedEmails.forEach((email) => { const thread = state.get(email.thread_id); if (thread) { email.claimed_by = thread.claimedBy; email.status = thread.status; } });
      }
    }
    setEmails(loadedEmails);
    setUnreadThreadIds([...new Set(loadedEmails.filter((email) => email.direction === 'inbound' && !email.read).map((email) => email.thread_id))]);
    setLoading(false);
  }, [activeSearch, filters, mode, selectedFolder]);

  useEffect(() => {
    const timer = setTimeout(() => setActiveSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/canned-responses').then((response) => response.ok ? response.json() : { responses: [] }).then((data) => setCannedResponses(data.responses || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedThread) { setThreadActivity([]); setThreadNotes([]); return; }
    Promise.all([fetch(`/api/threads/${selectedThread}/activity`), fetch(`/api/threads/${selectedThread}/notes`)]).then(async ([activityResponse, notesResponse]) => {
      const activity = activityResponse.ok ? await activityResponse.json() : { activity: [] };
      const notes = notesResponse.ok ? await notesResponse.json() : { notes: [] };
      setThreadActivity(activity.activity || []);
      setThreadNotes(notes.notes || []);
    }).catch(() => { setThreadActivity([]); setThreadNotes([]); });
  }, [selectedThread]);

  const threads = useMemo(() => {
    const grouped = new Map();
    for (const email of emails) { if (!grouped.has(email.thread_id)) grouped.set(email.thread_id, []); grouped.get(email.thread_id).push(email); }
    const values = [...grouped.values()].map((thread) => thread.sort((a, b) => new Date(a.received_at) - new Date(b.received_at)));
    const folderFiltered = selectedFolder === 'all' || (mode === 'outbox' && selectedFolder === 'sent') ? values : selectedFolder === 'starred' ? values.filter((thread) => thread.some((message) => message.starred)) : values.filter((thread) => (thread[0].folder || 'inbox') === selectedFolder);
    return folderFiltered.filter((thread) => selectedMailbox === 'all' || thread.some((message) => (message.mailboxAddresses || []).includes(selectedMailbox)));
  }, [emails, mode, selectedFolder, selectedMailbox]);

  const mailboxGroups = useMemo(() => {
    const counts = new Map();
    emails.forEach((email) => (email.mailboxAddresses || []).forEach((address) => counts.set(address, (counts.get(address) || 0) + 1)));
    return [...counts].map(([value, count]) => ({ value, label: value.split('@')[0], count, color: '#1769aa' })).sort((a, b) => a.label.localeCompare(b.label));
  }, [emails]);

  const activeThread = threads.find((thread) => thread[0].thread_id === selectedThread);
  const unreadCount = unreadThreadIds.length;
  const filterCount = Object.values(filters).filter(Boolean).length;

  const selectThread = useCallback(async (threadId) => {
    setSelectedThread(threadId); setClaimError(''); setUnreadThreadIds((current) => current.filter((id) => id !== threadId));
    if (mode === 'inbox') {
      await fetch(`/api/emails/${threadId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) });
      if (currentUser) {
        const response = await fetch('/api/threads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId, claim: true, claimedBy: currentUser }) });
        if (!response.ok) { const data = await response.json().catch(() => ({})); setClaimError(data.error || 'This thread is already claimed.'); }
      }
    }
  }, [currentUser, mode, setSelectedThread]);

  const bulkAction = useCallback(async (action, ids = selectedThreadIds) => {
    if (!ids.length) return;
    setActionError('');
    const response = await fetch('/api/emails/bulk', { method: action === 'delete' ? 'DELETE' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadIds: ids, action }) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); setActionError(data.error || 'Unable to update selected messages.'); return; }
    setSelectedThreadIds((current) => current.filter((id) => !ids.includes(id)));
    await load();
  }, [load, selectedThreadIds]);

  const deleteThread = useCallback(async (threadId) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this conversation?')) return;
    const response = await fetch(`/api/emails/${threadId}`, { method: 'DELETE' });
    if (response.ok) { setSelectedThread(null); await load(); }
  }, [load, setSelectedThread]);

  const starThread = useCallback(async (threadId, starred) => {
    await fetch(`/api/emails/${threadId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ starred: !starred }) });
    await load();
  }, [load]);

  const releaseThread = useCallback(async () => {
    if (!selectedThread || !currentUser) return;
    const response = await fetch('/api/threads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId: selectedThread, claim: false, claimedBy: currentUser }) });
    if (response.ok) await load();
  }, [currentUser, load, selectedThread]);

  const updateStatus = useCallback(async (status) => {
    if (!selectedThread) return;
    const response = await fetch('/api/threads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId: selectedThread, status }) });
    if (response.ok) await load();
  }, [load, selectedThread]);

  const addNote = useCallback(async (body) => {
    if (!selectedThread || !body.trim()) return;
    const response = await fetch(`/api/threads/${selectedThread}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
    if (response.ok) { const data = await response.json(); setThreadNotes((current) => [...current, data.note]); }
  }, [selectedThread]);

  return { emails, threads, activeThread, loading, load, search, setSearch, filters, setFilters, selectedMailbox, setSelectedMailbox, selectedFolder, setSelectedFolder, mailboxGroups, selectedThreadIds, setSelectedThreadIds, unreadThreadIds, unreadCount, filterCount, selectedThread, selectThread, setSelectedThread, bulkAction, deleteThread, starThread, releaseThread, updateStatus, claimError, actionError, threadActivity, threadNotes, addNote, cannedResponses };
}

function parseMailboxAddresses(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[;,]/);
  return values.map((item) => (String(item).match(/<([^>]+)>/)?.[1] || String(item)).trim().toLowerCase()).map((address) => address.replace(/^mailto:/, '').replace(/[\s"']/g, '')).filter((address) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address));
}
