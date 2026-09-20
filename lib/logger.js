export function logError(message, error, context = {}) {
  const entry = { level: 'error', message, error: error?.message || String(error || ''), context, timestamp: new Date().toISOString() };
  console.error(JSON.stringify(entry));
  if (process.env.SENTRY_DSN) {
    fetch(process.env.SENTRY_DSN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }).catch(() => {});
  }
}
