import express from "express";
import { requireAuth } from "../auth.js";
import {
    getSavedRecipes,
    saveRecipe,
    unsaveRecipe,
} from "../controllers/savedRecipeController.js";

const router = express.Router();

// Get saved recipe(s)
router.get("/saved-recipes", requireAuth, getSavedRecipes);

// Save a recipe
router.post("/recipes/:id/save", requireAuth, saveRecipe);

// Unsave a recipe
router.delete("/recipes/:id/save", requireAuth, unsaveRecipe);

export default router;