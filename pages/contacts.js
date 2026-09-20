import { useEffect, useState } from 'react';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const load = async () => { const response = await fetch(`/api/contacts?search=${encodeURIComponent(search)}`); if (response.ok) setContacts((await response.json()).contacts || []); };
  useEffect(() => { load(); }, [search]);
  return <main style={styles.main}><div style={styles.header}><h1>Contacts</h1><a href="/api/export?format=contacts">Export CSV</a></div><input style={styles.search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search contacts" />{contacts.map((contact) => <article key={contact.id} style={styles.row}><div><strong>{contact.name || contact.email}</strong><p>{contact.email}{contact.company ? ` · ${contact.company}` : ''}</p></div>{contact.vip && <span style={styles.vip}>VIP</span>}</article>)}</main>;
}
const styles = { main: { maxWidth: 760, margin: '0 auto', padding: 28, color: '#e5eef8' }, header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, search: { width: '100%', boxSizing: 'border-box', padding: 10, margin: '10px 0 16px', borderRadius: 7, border: '1px solid #36536e', background: '#0d1a2a', color: '#e5eef8' }, row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, marginBottom: 8, background: '#102033', border: '1px solid #29415b', borderRadius: 8 }, vip: { color: '#fbbf24', fontWeight: 700 } };
