import { getDB } from "../db.js";
import { logActivity } from "../lakehouse.js";
import {
    submitRatingService,
    getRecipeByIdService,
    getRatingSummaryService,
} from "../services/ratingService.js";

export async function submitRating(req, res) {
    try {
        const db = getDB();
        const recipeId = Number(req.params.id);
        const stars = Number(req.body?.stars);

        if (!recipeId) {
            return res.status(400).json({ error: "Invalid recipe id" });
        }

        if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5" });
        }

        const recipe = await getRecipeByIdService(db, recipeId);

        if (!recipe) {
            return res.status(404).json({ error: "Recipe not found" });
        }

        await submitRatingService(
            db,
            recipeId,
            req.user.id,
            stars
        );

        await logActivity(db, {
            userId: req.user.id,
            username: req.user.username,
            eventType: "rating_submit",
            entityType: "rating",
            entityId: recipeId,
            metadata: { route: "/recipes/:id/rating" },
        });

        const summary = await getRatingSummaryService(db, recipeId);

        return res.json({
            message: "Rating submitted successfully",
            rating: {
                stars,
                averageRating: summary?.averageRating ?? null,
                ratingCount: summary?.ratingCount ?? 0,
            },
        });

    } catch (err) {
        console.error("Rating submit error:", err);
        return res.status(500).json({ error: "Unable to submit rating" });
    }
}