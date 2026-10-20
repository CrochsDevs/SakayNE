import { Router } from "express";
import { getDB } from '../../config/db.js';

const router = Router();

router.get("/", (_req, res) => {
  const available = !!getDB();
  res.status(available ? 200 : 503).json({ status: available ? 'ok' : 'degraded', database: available ? 'connected' : 'unavailable' });
});

export default router;
