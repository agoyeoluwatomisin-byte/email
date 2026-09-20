import { useEffect, useState } from 'react';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: '', displayName: '', password: '', role: 'agent' });
  const load = async () => {
    const response = await fetch('/api/users');
    if (response.ok) setUsers((await response.json()).users || []);
  };
  useEffect(() => {
    load();
  }, []);
  const create = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (response.ok) {
      setForm({ email: '', displayName: '', password: '', role: 'agent' });
      await load();
    }
  };
  const update = async (user, values) => {
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, ...values }),
    });
    await load();
  };
  return (
    <main style={styles.main}>
      <h1>Users</h1>
      <form onSubmit={create} style={styles.form}>
        <input
          style={styles.input}
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
        <input
          style={styles.input}
          placeholder="Display name"
          value={form.displayName}
          onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          required
        />
        <input
          style={styles.input}
          placeholder="Temporary password"
          type="password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          required
        />
        <select
          style={styles.input}
          value={form.role}
          onChange={(event) => setForm({ ...form, role: event.target.value })}
        >
          <option value="agent">Agent</option>
          <option value="admin">Admin</option>
        </select>
        <button style={styles.button}>Create user</button>
      </form>
      {users.map((user) => (
        <article style={styles.row} key={user.id}>
          <div>
            <strong>{user.display_name || user.email}</strong>
            <p>
              {user.email} · {user.role} · {user.availability}
            </p>
          </div>
          <div>
            <button style={styles.button} onClick={() => update(user, { active: !user.active })}>
              {user.active ? 'Deactivate' : 'Activate'}
            </button>
            <button
              style={styles.button}
              onClick={() => update(user, { availability: user.availability === 'away' ? 'available' : 'away' })}
            >
              {user.availability === 'away' ? 'Set available' : 'Set away'}
            </button>
          </div>
        </article>
      ))}
    </main>
  );
}
const styles = {
  main: { maxWidth: 820, margin: '0 auto', padding: 28, color: '#e5eef8' },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
    padding: 16,
    background: '#102033',
    borderRadius: 8,
    marginBottom: 18,
  },
  input: { padding: 9, borderRadius: 6, border: '1px solid #36536e', background: '#0d1a2a', color: '#e5eef8' },
  button: {
    border: '1px solid #36536e',
    background: '#17283b',
    color: '#d7e5f2',
    borderRadius: 6,
    padding: '7px 9px',
    margin: 3,
    cursor: 'pointer',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
    border: '1px solid #29415b',
    borderRadius: 8,
    background: '#102033',
  },
};
