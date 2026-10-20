export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export function requireValue(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message);
}
