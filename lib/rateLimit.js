const fallback = new Map();

export async function consumeRateLimit(key, max, windowMs) {
  const now = Date.now();
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify([['INCR', `rl:${key}`], ['EXPIRE', `rl:${key}`, Math.ceil(windowMs / 1000)]]) });
      const result = await response.json();
      return Number(result?.[0]?.result || 0) > max;
    } catch (error) {
      console.error('Upstash rate limiter failed, using fallback:', error.message);
    }
  }
  for (const [entryKey, entry] of fallback) if (now - entry.start > windowMs) fallback.delete(entryKey);
  const entry = fallback.get(key) || { count: 0, start: now };
  if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
  entry.count += 1;
  fallback.set(key, entry);
  return entry.count > max;
}
