import express from "express";
import { requireAuth } from "../auth.js";
import { creatorDashboard } from "../controllers/creatorController.js";

const router = express.Router();

router.get("/creator/dashboard/:username", requireAuth, creatorDashboard);

export default router;