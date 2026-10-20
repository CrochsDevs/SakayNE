import { Router } from "express";
import { getNotifications, markRead, getSettings, updateSettings } from "./notifications.controller.js";

const router = Router();

router.get("/", getNotifications);
router.post("/mark-read", markRead);
router.get("/settings", getSettings);
router.put("/settings", updateSettings);

export default router;
