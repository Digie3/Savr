import { getDB } from "../db.js";

import {
    logActivityService,
    getAnalyticsDashboardService
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

export async function analyticsDashboard(req, res) {
    try {
        const dashboard = await getAnalyticsDashboardService(req.user.username);

        if (!dashboard) {
            return res.status(404).json({ error: "Analytics not found" });
        }

        // Convert DuckDB BigInts
        Object.keys(dashboard).forEach((key) => {
            if (typeof dashboard[key] === "bigint") {
                dashboard[key] = Number(dashboard[key]);
            }
        });

        res.json(dashboard);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load analytics" });
    }
}