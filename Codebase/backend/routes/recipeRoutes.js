import express from "express";
import { requireAuth } from "../auth.js";
import upload from "../middleware/recipeImageUpload.js";
import { createRecipe, getRecipes, getRecipe, deleteRecipe } from "../controllers/recipeController.js";

const router = express.Router();


// Create Recipe
router.post("/create", requireAuth, upload.any(), createRecipe);

// Recipe Home Feed
router.get("/recipes", getRecipes);

// Recipe Post Details
router.get("/recipes/:id", getRecipe);

// Delete Recipe
router.delete("/recipes/:id", requireAuth, deleteRecipe);

export default router;
