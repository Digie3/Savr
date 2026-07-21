import { getCreatorDashboard } from "../services/creatorService.js";

export async function creatorDashboard(req, res) {
    try {
        const dashboard = await getCreatorDashboard(req.params.username);

        if (!dashboard) {
            return res.status(404).json({
                error: "Dashboard not found"
            });
        }

        Object.keys(dashboard).forEach((key) => {
            if (typeof dashboard[key] === "bigint") {
                dashboard[key] = Number(dashboard[key]);
            }
        });

        res.json(dashboard);
    } catch (err) {
        console.error(err);

        res.status(500).json({ error: "Failed to load dashboard" });
    }
}