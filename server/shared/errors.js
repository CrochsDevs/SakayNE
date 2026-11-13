export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export function requireValue(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message);
}

// Only deliberate HTTP errors may be exposed; database/provider failures can contain credentials.
export function sendError(res, error) {
  const status = error.code === 11000 ? 409 : error instanceof HttpError ? error.status : 500;
  return res.status(status).json({ error: error.code === 11000 ? 'Record already exists' : error instanceof HttpError ? error.message : 'Server could not complete the request', ...(error.code === 'EMAIL_DELIVERY_UNAVAILABLE' ? { code: error.code } : {}) });
}
