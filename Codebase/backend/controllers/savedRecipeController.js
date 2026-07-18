import { getDB } from "../db.js";
import { logActivity } from "../lakehouse.js";
import {
    getSavedRecipesService,
    saveRecipeService,
    insertSavedRecipeService,
    unsaveRecipeService
} from "../services/savedRecipeService.js";

export async function getSavedRecipes(req, res) {
    try {
        const db = getDB();
        const recipes = await getSavedRecipesService(db, req.user.id);

        return res.json({ recipes });
    } catch (err) {
        console.error("Saved recipes error:", err);
        return res.status(500).json({ error: "Unable to load saved recipes" });
    }
}

export async function saveRecipe(req, res) {
    try {
        const db = getDB();
        const recipeId = Number(req.params.id);

        if (!recipeId) {
            return res.status(400).json({ error: "Invalid recipe id" });
        }

        //CHANGE
        const recipe = await saveRecipeService(db, recipeId);

        if (!recipe) {
            return res.status(404).json({ error: "Recipe not found" });
        }

        await insertSavedRecipeService(db, req.user.id, recipeId);

        await logActivity(db, {
            userId: req.user.id,
            username: req.user.username,
            eventType: "recipe_save",
            entityType: "recipe",
            entityId: recipeId,
            metadata: { route: "/recipes/:id/save" },
        });

        return res.json({ saved: true });

    } catch (err) {
        console.error("Save recipe error:", err);
        return res.status(500).json({ error: "Unable to save recipe" });
    }
}

export async function unsaveRecipe(req, res) {
    try {
        const db = getDB();
        const recipeId = Number(req.params.id);

        if (!recipeId) {
            return res.status(400).json({ error: "Invalid recipe id" });
        }

        await unsaveRecipeService(db, req.user.id, recipeId);

        await logActivity(db, {
            userId: req.user.id,
            username: req.user.username,
            eventType: "recipe_unsave",
            entityType: "recipe",
            entityId: recipeId,
            metadata: { route: "/recipes/:id/save" },
        });

        return res.json({ saved: false });

    } catch (err) {
        console.error("Unsave recipe error:", err);
        return res.status(500).json({ error: "Unable to unsave recipe" });
    }
}