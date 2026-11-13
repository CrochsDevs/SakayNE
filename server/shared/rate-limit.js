export function rateLimit(limit = 30, windowMs = 15 * 60000) {
  const clients = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, entry] of clients) if (entry.expires <= now) clients.delete(key);
    const key = req.ip;
    // Refuse new buckets at capacity instead of allowing unbounded memory growth.
    if (!clients.has(key) && clients.size >= 10000) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }
    const entry = clients.get(key) || { count: 0, expires: now + windowMs };
    if (++entry.count > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.expires - now) / 1000))));
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }
    clients.set(key, entry);
    next();
  };
}
