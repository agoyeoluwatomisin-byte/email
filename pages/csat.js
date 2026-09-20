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
        background: '#07111f',
        color: '#e5eef8',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1>{state}</h1>
    </main>
  );
}
