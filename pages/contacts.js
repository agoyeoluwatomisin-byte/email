import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, EmptyState, Input, PageHeader, Skeleton, Textarea, Toggle } from '../components/ui';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/contacts?search=${encodeURIComponent(search)}`);
      if (!response.ok) throw new Error('Unable to load contacts.');
      const data = await response.json();
      const nextContacts = data.contacts || [];
      setContacts(nextContacts);
      if (!selectedId && nextContacts[0]) setSelectedId(nextContacts[0].id);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    fetch(`/api/contacts/${selectedId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Unable to load contact.'))))
      .then(setSelected)
      .catch((loadError) => setError(loadError.message));
  }, [selectedId]);

  const updateSelected = (field, value) => setSelected((current) => ({ ...current, contact: { ...current.contact, [field]: value } }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    const response = await fetch(`/api/contacts/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selected.contact),
    });
    if (response.ok) {
      const data = await response.json();
      setSelected((current) => ({ ...current, contact: data.contact }));
      setContacts((current) => current.map((contact) => (contact.id === data.contact.id ? data.contact : contact)));
    } else setError('Unable to save contact.');
    setSaving(false);
  };

  return (
    <div className="content-page contacts-page">
      <PageHeader
        title="Contacts"
        description="Keep customer context close to every conversation."
        actions={<a className="ui-button ui-button-secondary" href="/api/export?format=contacts">Export CSV</a>}
      />
      <div className="contacts-layout">
        <Card className="contacts-list-card">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search contacts" aria-label="Search contacts" />
          {loading && <><Skeleton /><Skeleton /><Skeleton /></>}
          {!loading && error && <EmptyState title="Could not load contacts" message={error} action={<Button onClick={load}>Retry</Button>} />}
          {!loading && !error && !contacts.length && <EmptyState title="No contacts yet" message="Contacts will appear as messages arrive." />}
          {!loading && !error && contacts.map((contact) => (
            <button key={contact.id} type="button" className={`contact-list-row ${selectedId === contact.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(contact.id)}>
              <span><strong>{contact.name || contact.email}</strong><small>{contact.email}</small></span>
              {contact.vip && <span className="contact-vip">VIP</span>}
            </button>
          ))}
        </Card>
        <Card className="contact-detail-card">
          {!selected?.contact ? <EmptyState title="Select a contact" message="Choose a contact to view details and history." /> : (
            <>
              <div className="contact-detail-heading"><div><h2>{selected.contact.name || selected.contact.email}</h2><p>{selected.contact.email}</p></div><Toggle checked={Boolean(selected.contact.vip)} onChange={(value) => updateSelected('vip', value)} label="VIP" /></div>
              <form className="contact-form" onSubmit={save}>
                <Input label="Name" value={selected.contact.name || ''} onChange={(event) => updateSelected('name', event.target.value)} />
                <Input label="Company" value={selected.contact.company || ''} onChange={(event) => updateSelected('company', event.target.value)} />
                <Input label="Phone" value={selected.contact.phone || ''} onChange={(event) => updateSelected('phone', event.target.value)} />
                <Textarea label="Notes" value={selected.contact.notes || ''} onChange={(event) => updateSelected('notes', event.target.value)} />
                <Button type="submit" variant="primary" loading={saving}>Save contact</Button>
              </form>
              <div className="contact-history"><h3>Thread history</h3>{selected.history?.length ? selected.history.map((item) => <Link key={item.id} href={`/inbox?thread=${item.thread_id}`} className="contact-history-row"><span>{item.subject || '(no subject)'}</span><small>{item.direction} · {new Date(item.received_at).toLocaleDateString()}</small></Link>) : <p className="ui-muted">No messages yet.</p>}</div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
