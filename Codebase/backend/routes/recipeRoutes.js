import express from "express";
import { requireAuth } from "../auth.js";
import upload from "../middleware/recipeImageUpload.js";
import { createRecipe, getRecipes, getRecipe } from "../controllers/recipeController.js";

const router = express.Router();


// Create Recipe
router.post("/create", requireAuth, upload.any(), createRecipe);

// Recipe Home Feed
router.get("/recipes", getRecipes);

// Recipe Post Details
router.get("/recipes/:id", getRecipe);

export default router;
