import { getDB } from "../db.js";

import {
    logActivityService,
    getAnalyticsSummaryService,
    getRecentEventsService,
    getTrendingEntitiesService,
} from "../services/analyticsService.js";

export async function logActivityEvent(req, res) {
    try {
        const db = getDB();
        await logActivityService(db, req.body || {});

        return res.status(201).json({ message: "Activity event logged" });

    } catch (err) {
        return res.status(400).json({ error: err.message || "Invalid activity event" });
    }
}

export async function getAnalyticsSummary(req, res) {
    try {
        const db = getDB();
        const summary = await getAnalyticsSummaryService(db);
        return res.json(summary);

    } catch (err) {
        console.error(err);

        return res.status(500).json({ error: "Server error" });
    }
}

export async function getAnalyticsEvents(req, res) {
    try {
        const db = getDB();
        const events = await getRecentEventsService(db, req.query.limit);

        return res.json({ events });

    } catch (err) {
        console.error(err);

        return res.status(500).json({ error: "Server error" });
    }
}

export async function getTrendingAnalytics(req, res) {
    try {
        const db = getDB();
        const entities = await getTrendingEntitiesService(db, req.query.days, req.query.limit);

        return res.json({ entities });

    } catch (err) {
        console.error(err);

        return res.status(500).json({ error: "Server error" });
    }
}