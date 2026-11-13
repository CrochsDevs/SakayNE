import { Router } from 'express';
import { authenticate } from '../../shared/session.js';
import { asyncRoute, requireValue } from '../../shared/errors.js';
import { rateLimit } from '../../shared/rate-limit.js';
import { mapServices } from './maps.service.js';

const router = Router();
router.use(authenticate, rateLimit(60, 60000));
router.get('/route', asyncRoute(async (req, res) => res.json({ route: await mapServices.route(req.query.coordinates) })));
router.get('/search', asyncRoute(async (req, res) => res.json({ places: await mapServices.search(req.query.q) })));
router.get('/reverse', asyncRoute(async (req, res) => {
  requireValue(typeof req.query.lat === 'string' && req.query.lat.trim() !== '' && typeof req.query.lon === 'string' && req.query.lon.trim() !== '', 'Provide location coordinates');
  res.json({ place: await mapServices.reverse(Number(req.query.lat), Number(req.query.lon)) });
}));
export default router;
