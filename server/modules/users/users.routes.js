import { Router } from "express";
import { getProfile, updateProfile, uploadAvatar } from "./users.controller.js";

const router = Router();

router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.post("/upload-avatar", uploadAvatar);

export default router;
