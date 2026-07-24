import express from "express";
import { requireAuth } from "../auth.js";
import {
    logActivityEvent,
    analyticsDashboard
} from "../controllers/analyticsController.js";

const router = express.Router();

router.post("/activity", logActivityEvent);
router.get("/analytics/dashboard", requireAuth, analyticsDashboard);

export default router;