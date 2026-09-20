import { useEffect, useState } from 'react';
import { Button, Card, DataTable, EmptyState, Input, PageHeader, Select, Skeleton } from '../components/ui';
import { useAppSession } from '../context/AppSessionProvider';

export default function Users() {
  const { role } = useAppSession();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: '', displayName: '', password: '', role: 'agent' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const response = await fetch('/api/users');
    if (response.ok) setUsers((await response.json()).users || []);
    else setError('Only administrators can manage users.');
    setLoading(false);
  };

  useEffect(() => {
    if (role === 'admin') load();
    else setLoading(false);
  }, [role]);

  const create = async (event) => {
    event.preventDefault();
    setSaving(true);
    const response = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (response.ok) {
      setForm({ email: '', displayName: '', password: '', role: 'agent' });
      await load();
    } else setError((await response.json().catch(() => ({}))).error || 'Unable to create user.');
    setSaving(false);
  };

  const update = async (user, values) => {
    await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, ...values }) });
    await load();
  };

  if (role !== 'admin') return <EmptyState title="Admin access required" message="User management is only available to administrators." />;

  const columns = [
    { key: 'identity', label: 'User', render: (user) => <span className="table-identity"><strong>{user.display_name || user.email}</strong><small>{user.email}</small></span> },
    { key: 'role', label: 'Role', render: (user) => <span className="ui-badge">{user.role}</span> },
    { key: 'availability', label: 'Availability', render: (user) => user.availability || 'available' },
    { key: 'status', label: 'Status', render: (user) => user.active ? 'Active' : 'Inactive' },
    { key: 'actions', label: 'Actions', render: (user) => <span className="table-actions"><Button variant="secondary" onClick={() => update(user, { active: !user.active })}>{user.active ? 'Deactivate' : 'Activate'}</Button><Button variant="ghost" onClick={() => update(user, { availability: user.availability === 'away' ? 'available' : 'away' })}>{user.availability === 'away' ? 'Set available' : 'Set away'}</Button></span> },
  ];

  return (
    <div className="content-page users-page">
      <PageHeader title="Users" description="Invite teammates and manage access." />
      <Card className="invite-card">
        <form className="invite-form" onSubmit={create}>
          <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <Input label="Display name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required />
          <Input label="Temporary password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          <Select label="Role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </Select>
          <Button type="submit" variant="primary" loading={saving}>Invite user</Button>
        </form>
      </Card>
      {error && <p className="ui-error" role="alert">{error}</p>}
      {loading ? <Card><Skeleton /><Skeleton /><Skeleton /></Card> : users.length ? <DataTable columns={columns} rows={users} /> : <EmptyState title="No users found" message="Invite your first teammate above." />}
    </div>
  );
}
