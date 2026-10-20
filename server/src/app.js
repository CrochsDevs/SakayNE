import express from "express";
import cors from "cors";
import { getDB } from "../config/db.js";
import authRoutes from "../modules/auth/auth.routes.js";
import usersRoutes from "../modules/users/users.routes.js";
import healthRoutes from "../modules/health/health.routes.js";
import otpRoutes from "../modules/otp/otp.routes.js";
import notificationsRoutes from "../modules/notifications/notifications.routes.js";
import tokensRoutes from "../modules/tokens/tokens.routes.js";
import ridesRoutes from '../modules/rides/rides.routes.js';
import driversRoutes, { adminDrivers } from '../modules/drivers/drivers.routes.js';
import { authenticate } from '../shared/session.js';
import { rateLimit } from '../shared/rate-limit.js';

const app = express();
const authLimiter = rateLimit(30);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/api", (req, res, next) => {
  if (!getDB() && req.path !== "/health") {
    return res.status(503).json({ error: "Database not available" });
  }
  next();
});

app.use("/api/auth", (req, res, next) => req.path === '/me' || req.path === '/logout' ? next() : authLimiter(req, res, next), authRoutes);
app.use("/api/users", authenticate, usersRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/otp", rateLimit(15), otpRoutes);
app.use("/api/notifications", authenticate, notificationsRoutes);
app.use("/api/tokens", authenticate, tokensRoutes);
app.use('/api/rides', ridesRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/admin/drivers', adminDrivers);
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || (err.code === 11000 ? 409 : 500);
  res.status(status).json({ error: err.code === 11000 ? 'Booking already exists. Refresh and try again.' : status < 500 ? err.message : 'Server could not complete the request' });
});

export default app;
