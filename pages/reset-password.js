import { useRouter } from 'next/router';
import { useState } from 'react';

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: router.query.token, password }),
    });
    const data = await response.json();
    setMessage(response.ok ? 'Password reset. You can sign in now.' : data.error || 'Unable to reset password.');
  };

  return (
    <main style={styles.main}>
      <form onSubmit={submit} style={styles.form}>
        <h1 style={styles.title}>Reset password</h1>
        <input
          type="password"
          minLength={12}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="New password"
          style={styles.input}
        />
        <button type="submit" style={styles.button}>
          Reset password
        </button>
        {message ? <p style={styles.message}>{message}</p> : null}
      </form>
    </main>
  );
}

const styles = {
  main: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--app-bg)',
    color: 'var(--app-text)',
    padding: 24,
  },
  form: {
    width: 'min(92vw, 420px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 24,
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 'var(--app-radius-lg)',
    boxShadow: 'var(--app-shadow)',
  },
  title: { margin: 0, color: 'var(--app-text)', fontSize: 28 },
  input: {
    padding: 10,
    borderRadius: 'var(--app-radius-sm)',
    border: '1px solid var(--app-border)',
    background: 'var(--app-surface-raised)',
    color: 'var(--app-text)',
  },
  button: {
    padding: 10,
    border: 0,
    borderRadius: 'var(--app-radius-sm)',
    background: 'var(--app-accent)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  message: { margin: 0, color: 'var(--app-muted)' },
};
