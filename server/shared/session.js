import { randomBytes, createHash } from 'node:crypto';
import { getDB } from '../config/db.js';
import { asyncRoute, requireValue } from './errors.js';

const hash = token => createHash('sha256').update(token).digest('hex');
export async function createSession(email, role) {
  const token = randomBytes(32).toString('hex');
  await getDB().collection('sessions').insertOne({ tokenHash: hash(token), email, role, expiresAt: new Date(Date.now() + 7 * 86400000) });
  return token;
}
export const authenticate = asyncRoute(async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  requireValue(typeof token === 'string' && token.length === 64, 'Please sign in again', 401);
  const session = await getDB().collection('sessions').findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } });
  requireValue(session, 'Session expired. Please sign in again', 401);
  const user = await getDB().collection('users').findOne({ email: session.email });
  requireValue(user, 'Account not found', 401);
  req.auth = { email: session.email, role: session.role, userId: user._id.toString(), tokenHash: session.tokenHash };
  // Legacy modules now derive identity from the session rather than caller input.
  req.headers['user-id'] = req.auth.userId;
  req.headers['user-email'] = req.auth.email;
  if (req.body && typeof req.body === 'object') req.body.email = req.auth.email;
  next();
});
export const requireRole = role => (req, res, next) => req.auth.role === role ? next() : res.status(403).json({ error: 'This account cannot perform that action' });
