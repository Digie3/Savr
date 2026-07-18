import { getDB } from "../db.js";
import {
  createRecipeService,
  getAllRecipes,
  getRecipeById,
  getRecipeIngredients,
  getRecipeSteps,
  getRecipeComments
} from "../services/recipeService.js";
import { getOptionalUserId } from "../helpers/authHelper.js";
import { cleanupUploadedFiles } from "../helpers/imageHelper.js";
import { logActivity } from "../lakehouse.js";

export async function createRecipe(req, res) {
  try {
    const db = getDB();

    const {
      title,
      description,
      prep_time,
      cooking_time,
      num_servings
    } = req.body;

    //Convertion into a Number
    const prepTime = Number(prep_time);
    const cookingTime = Number(cooking_time);
    const numServings = Number(num_servings);

    // CHECK: Recipe
    const errors = [];

    if (!title || !title.trim()) { // TITLE
      errors.push("Title is required");
    }
    else if (title.length > 100) {
      errors.push("Title can have at most 100 characters");
    }

    if (description && description.length > 1000) { // DESCRIPTION
      errors.push("Description can have at most 1000 characters");
    }

    if (prep_time === undefined || prep_time === null || prep_time === "") { // PREP TIME
      errors.push("Preparation time is required");
    }
    else if (prepTime < 0) {
      errors.push("Preparation time cannot be negative");
    }

    if (cooking_time === undefined || cooking_time === null || cooking_time === "") { // COOKING TIME
      errors.push("Cooking time is required");
    }
    else if (cookingTime < 0) {
      errors.push("Cooking time cannot be negative");
    }

    if (num_servings === undefined || num_servings === null || num_servings === "") { // # OF SERVINGS
      errors.push("Number of servings is required");
    }
    else if (numServings < 1) {
      errors.push("Number of Servings must be at least 1 servings");
    }

    //CHECK: Ingredients
    const submittedIngredients = req.body.ingredients || [];

    if (!Array.isArray(submittedIngredients) || submittedIngredients.length === 0) {
      errors.push("At least one ingredient is required");
    }

    for (let i = 0; i < submittedIngredients.length; i++) {
      const ingredient = submittedIngredients[i];
      const name = ingredient.name;
      const stringQty = ingredient.quantity;
      const quantity = Number(ingredient.quantity);
      const unit = ingredient.unit;

      if (!name || !name.trim()) {
        errors.push(`Ingredient ${i + 1} name is required`);
      }

      if (stringQty === undefined || stringQty === null || stringQty === "") {
        errors.push(`Ingredient ${i + 1} quantity is required`);
      }
      else if (Number(quantity) <= 0) {
        errors.push(`Ingredient ${i + 1} quantity must be greater than 0`);
      }

      if (!unit || !unit.trim()) {
        errors.push(`Ingredient ${i + 1} unit is required`);
      }
    }

    // CHECK: Steps
    const stepKeys = Object.keys(req.body).filter((key) => key.startsWith("step_text_"));

    if (stepKeys.length === 0) {
      errors.push("At least one recipe step is required");
    }

    for (const key of stepKeys) {
      const stepIndex = Number(key.replace("step_text_", ""));
      const stepText = req.body[key];

      if (!stepText || !stepText.trim()) {
        errors.push(`Step ${stepIndex + 1} is required`);
      }
      else if (stepText.length > 500) {
        errors.push(`Step ${stepIndex + 1} can have at most 500 characters`);
      }
    }

    //CHECK: If an errors are present, return errors list
    if (errors.length > 0) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ errors });
    }

    const result = await createRecipeService(db, req);

    await logActivity(db, {
      userId: req.user.id,
      username: req.user.username,
      eventType: "recipe_create",
      entityType: "recipe",
      entityId: result.recipeId,
      metadata: { route: "/create" },
    });

    return res.status(201).json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json(err.body);
    }

    console.error(err);
    return res.status(500).json({ error: "Failed to Post Recipe" });
  }
}

export async function getRecipes(req, res) {
  try {

    const db = getDB();
    const viewerId = await getOptionalUserId(req);
    const recipes = await getAllRecipes(db, viewerId);

    return res.json({
      recipes,
    });

  } catch (err) {

    console.error("Recipe feed error:", err);

    return res.status(500).json({
      error: "Unable to load recipes",
    });

  }
}

export async function getRecipe(req, res) {
  try {
    const db = getDB();
    const recipeId = Number(req.params.id);
    const viewerId = await getOptionalUserId(req);

    if (!recipeId) {
      return res.status(400).json({ error: "Invalid recipe id" });
    }

    const recipe = await getRecipeById(db, recipeId, viewerId);

    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    const ingredients = await getRecipeIngredients(db, recipeId);
    const steps = await getRecipeSteps(db, recipeId);
    const comments = await getRecipeComments(db, recipeId);

    await logActivity(db, {
      eventType: "recipe_view",
      entityType: "recipe",
      entityId: recipeId,
      metadata: { route: "/recipes/:id" },
    });

    return res.json({ recipe, ingredients, steps, comments });

  } catch (err) {

    console.error("Recipe detail error:", err);
    return res.status(500).json({ error: "Unable to load recipe" });
  }
}
