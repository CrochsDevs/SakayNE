import { Router } from "express";
import { signup, checkEmail, login, verifyEmail, forgotPassword, resetPassword, changePassword } from "./auth.controller.js";
import { authenticate } from '../../shared/session.js';
import { asyncRoute } from '../../shared/errors.js';
import { getDB } from '../../config/db.js';

const router = Router();

router.post("/signup", signup);
router.post("/check-email", asyncRoute(checkEmail));
router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", authenticate, changePassword);
router.get('/me', authenticate, asyncRoute(async (req, res) => {
  const profile = await getDB().collection('users').findOne({ email: req.auth.email });
  const driver = req.auth.role === 'driver' && await getDB().collection('drivers').findOne({ email: req.auth.email });
  res.json({ user: { ...profile, role: req.auth.role, verified: req.auth.role !== 'driver' || !!driver?.verified,
    approvalStatus: req.auth.role === 'driver' ? driver?.approvalStatus || 'pending' : 'approved' } });
}));
router.post('/logout', authenticate, asyncRoute(async (req, res) => {
  await getDB().collection('sessions').deleteOne({ tokenHash: req.auth.tokenHash });
  res.json({ success: true });
}));

export default router;
