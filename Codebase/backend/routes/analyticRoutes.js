import express from "express";
import {
    logActivityEvent,
    getAnalyticsSummary,
    getAnalyticsEvents,
    getTrendingAnalytics,
} from "../controllers/analyticsController.js";

const router = express.Router();

router.post("/activity", logActivityEvent);
router.get("/analytics/summary", getAnalyticsSummary);
router.get("/analytics/events", getAnalyticsEvents);
router.get("/analytics/trending", getTrendingAnalytics);

export default router;