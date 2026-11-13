import { HttpError } from './errors.js';

export function allowedOrigin(origin) {
  if (!origin) return true; // Native clients and server-to-server requests do not use CORS.
  const configured = (process.env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (configured.includes(origin)) return true;
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol) && /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname);
  } catch { return false; }
}

export const corsOptions = {
  origin(origin, done) { done(allowedOrigin(origin) ? null : new HttpError(403, 'Origin is not allowed'), true); },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'user-id', 'user-email'],
};

export function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  });
  next();
}
