export function rateLimit(limit = 30, windowMs = 15 * 60000) {
  const clients = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, entry] of clients) if (entry.expires <= now) clients.delete(key);
    const key = req.ip;
    const entry = clients.get(key) || { count: 0, expires: now + windowMs };
    if (++entry.count > limit) return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    clients.set(key, entry);
    next();
  };
}
