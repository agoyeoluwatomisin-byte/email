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
        <h1>Reset password</h1>
        <input
          type="password"
          minLength={12}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="New password"
          style={styles.input}
        />
        <button style={styles.button}>Reset password</button>
        {message && <p>{message}</p>}
      </form>
    </main>
  );
}
const styles = {
  main: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#07111f', color: '#e5eef8' },
  form: {
    width: 'min(92vw, 420px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 24,
    background: '#102033',
    borderRadius: 10,
  },
  input: { padding: 10, borderRadius: 6, border: '1px solid #36536e', background: '#0d1a2a', color: '#e5eef8' },
  button: { padding: 10, border: 0, borderRadius: 6, background: '#2f8fca', color: '#fff', cursor: 'pointer' },
};
