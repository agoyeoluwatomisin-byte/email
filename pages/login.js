import { useRouter } from 'next/router';
import { useState } from 'react';
import { useAppSession } from '../context/AppSessionProvider';

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAppSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, twoFactorCode }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid email or password.');
        return;
      }

      await refresh();
      router.push('/dashboard');
    } catch (requestError) {
      setError('Unable to sign in right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.brand}>Email Portal</div>
          <h1 style={styles.title}>Sign in</h1>
        </div>

        <form style={styles.form} onSubmit={handleSubmit}>
          <label style={styles.label} htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={styles.input}
            autoComplete="email"
            required
          />

          <label style={styles.label} htmlFor="twoFactorCode">
            Authenticator code (if enabled)
          </label>
          <input
            id="twoFactorCode"
            type="text"
            inputMode="numeric"
            value={twoFactorCode}
            onChange={(event) => setTwoFactorCode(event.target.value)}
            style={styles.input}
            autoComplete="one-time-code"
            maxLength={6}
          />

          <label style={styles.label} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={styles.input}
            autoComplete="current-password"
            required
          />

          {error ? <div style={styles.error}>{error}</div> : null}

          <button type="submit" style={styles.button} disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </div>
    </main>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--app-bg)',
    color: 'var(--app-text)',
    padding: '24px',
    fontFamily: 'var(--app-font, ui-sans-serif, system-ui, sans-serif)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 'var(--app-radius-lg)',
    padding: '28px 24px',
    boxShadow: 'var(--app-shadow)',
  },
  header: { marginBottom: 24 },
  brand: {
    fontSize: 12,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--app-muted)',
    marginBottom: 8,
  },
  title: { margin: 0, color: 'var(--app-text)', fontSize: 32, fontWeight: 700 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  label: { color: 'var(--app-text)', fontSize: 14, fontWeight: 600 },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 'var(--app-radius-sm)',
    border: '1px solid var(--app-border)',
    outline: 'none',
    background: 'var(--app-surface-raised)',
    color: 'var(--app-text)',
    boxSizing: 'border-box',
    fontSize: 15,
  },
  button: {
    marginTop: 8,
    padding: '12px 16px',
    border: 'none',
    borderRadius: 'var(--app-radius-sm)',
    background: 'var(--app-accent)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  error: {
    marginTop: 6,
    padding: '10px 12px',
    borderRadius: 'var(--app-radius-sm)',
    background: 'color-mix(in srgb, var(--app-danger) 16%, transparent)',
    border: '1px solid color-mix(in srgb, var(--app-danger) 45%, transparent)',
    color: 'var(--app-danger)',
    fontSize: 14,
  },
};
