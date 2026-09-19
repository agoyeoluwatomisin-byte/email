import { useRouter } from 'next/router';
import { useState } from 'react';

const VALID_EMAIL = 'agosoft@agosoft.com.ng';
const VALID_PASSWORD = 'agoye321@agosoft.com.ng';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(VALID_EMAIL);
  const [password, setPassword] = useState(VALID_PASSWORD);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (email.trim() === VALID_EMAIL && password === VALID_PASSWORD) {
        localStorage.setItem('email_session', JSON.stringify({ email: VALID_EMAIL }));
        router.push('/dashboard');
        return;
      }

      setError('Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.brand}>Email Portal</div>
          <h1 style={styles.title}>Sign in</h1>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
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
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #020817 0%, #0f172a 50%, #111827 100%)',
    padding: '24px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'rgba(15, 23, 42, 0.9)',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    borderRadius: 18,
    padding: '28px 24px',
    boxShadow: '0 24px 48px rgba(2, 6, 23, 0.45)',
  },
  header: {
    marginBottom: 24,
  },
  brand: {
    fontSize: 12,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#94a3b8',
    marginBottom: 8,
  },
  title: {
    margin: 0,
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: 700,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 600,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid rgba(148, 163, 184, 0.4)',
    outline: 'none',
    background: '#0f172a',
    color: '#f8fafc',
    boxSizing: 'border-box',
    fontSize: 15,
  },
  button: {
    marginTop: 8,
    padding: '12px 16px',
    border: 'none',
    borderRadius: 10,
    background: '#38bdf8',
    color: '#082f49',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  error: {
    marginTop: 6,
    padding: '10px 12px',
    borderRadius: 8,
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.42)',
    color: '#fca5a5',
    fontSize: 14,
  },
};
