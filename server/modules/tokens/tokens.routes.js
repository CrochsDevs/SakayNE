import { Router } from "express";
import { getBalance, getHistory, addTokens, getCompletedTasks, completeTask, claimDaily, getDailyClaims } from "./tokens.controller.js";

const router = Router();

router.get("/balance", getBalance);
router.get("/history", getHistory);
router.post("/add", addTokens);
router.get("/completed-tasks", getCompletedTasks);
router.post("/complete-task", completeTask);
router.post("/claim-daily", claimDaily);
router.get("/daily-claims", getDailyClaims);

export default router;
