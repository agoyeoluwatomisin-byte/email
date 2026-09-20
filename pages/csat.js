import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function CsatPage() {
  const router = useRouter();
  const [state, setState] = useState('Submitting your rating...');

  useEffect(() => {
    if (!router.isReady) return;
    fetch('/api/csat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: router.query.token, rating: Number(router.query.rating) }),
    })
      .then((response) =>
        setState(response.ok ? 'Thank you for your feedback.' : 'This survey link is invalid or expired.'),
      )
      .catch(() => setState('Unable to submit your feedback.'));
  }, [router.isReady, router.query.rating, router.query.token]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--app-bg)',
        color: 'var(--app-text)',
        fontFamily: 'var(--app-font, ui-sans-serif, system-ui, sans-serif)',
        padding: 24,
      }}
    >
      <h1 style={{ margin: 0, color: 'var(--app-text)' }}>{state}</h1>
    </main>
  );
}
