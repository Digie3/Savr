import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import bodyParser from "body-parser";
import cors from "cors";
import bcrypt from "bcryptjs";
import { initDB, getDB } from "./db.js";
import { signToken, requireAuth } from "./auth.js";
import {
  getAnalyticsSummary,
  getRecentEvents,
  getTrendingEntities,
  initLakehouse,
  logActivity,
} from "./lakehouse.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.user.id;
    let folder = "misc";

    if (file.fieldname === "recipeImage") {
      folder = "recipes";
    }
    else if (file.fieldname.includes("ingredients")) {
      folder = "ingredients";
    }
    else if (file.fieldname.includes("step_image")) {
      folder = "steps";
    }

    const uploadPath = path.join(
      "uploads",
      `user_${userId}`,
      folder
    );

    fs.mkdirSync(uploadPath, {
      recursive: true
    });

    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    cb(
      null,
      `${Date.now()}-${file.originalname}`
    );
  },
});

const upload = multer({
  storage,
});

app.use(
  "/uploads",
  express.static("uploads")
);

async function start() {
  await initDB();
  const db = getDB();
  await initLakehouse(db);

  app.get("/health", (req, res) => {
    return res.json({ status: "ok", service: "savr-backend" });
  });

  //Register
  app.post("/register", async (req, res) => {
    try {
      const { username, password } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({ error: "Missing fields" });
      }

      const hashed = await bcrypt.hash(password, 10);

      await db.runAsync(
        `INSERT INTO Users (username, password, account_creation) VALUES (?, ?, datetime('now'))`,
        [username, hashed]
      );

      await logActivity(db, {
        username,
        eventType: "register",
        entityType: "user",
        entityId: username,
        metadata: { route: "/register" },
      });

      return res.status(201).json({ username });
    } catch (err) {
      if (err && err.message && err.message.includes("UNIQUE")) {
        return res.status(409).json({ error: "User already exists" });
      }

      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  //Login
  app.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body || {};

      if (!username || !password) return res.status(400).json({ error: "Missing fields" });

      const user = await db.getAsync(`SELECT idUsers, username, password FROM Users WHERE username = ?`, [username]);

      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const match = await bcrypt.compare(password, user.password);

      if (!match) return res.status(401).json({ error: "Invalid credentials" });

      await logActivity(db, {
        userId: user.idUsers,
        username: user.username,
        eventType: "login",
        entityType: "user",
        entityId: user.idUsers,
        metadata: { route: "/login" },
      });

      // Issue a JWT the client stores and sends back on future requests.
      const token = signToken(user);
      return res.json({ token, user: { id: user.idUsers, username: user.username } });
    } catch (err) {
      console.error(err);

      return res.status(500).json({ error: "Server error" });
    }
  });

  // Session validation: returns the current user if the bearer token is valid.
  app.get("/me", requireAuth, async (req, res) => {
    const user = await db.getAsync(
      `SELECT idUsers, username FROM Users WHERE idUsers = ?`,
      [req.user.id]
    );
    if (!user) return res.status(401).json({ error: "User no longer exists" });
    return res.json({ user: { id: user.idUsers, username: user.username } });
  });

  // Logout. With stateless JWTs the token is discarded on the client; this
  // endpoint gives the frontend a logout call and a place to add a token
  // blocklist later without changing the frontend.
  app.post("/logout", requireAuth, (req, res) => {
    return res.json({ ok: true });
  });
  // Follow Service - follow a user
  app.post("/follow/:idFollowed", requireAuth, async (req, res) => {
    try {
      const idFollower = req.user.id;
      const idFollowed = Number(req.params.idFollowed);

      if (!idFollowed) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      if (idFollower === idFollowed) {
        return res.status(400).json({ error: "You cannot follow yourself" });
      }

      const userToFollow = await db.getAsync(
        `SELECT idUsers, username FROM Users WHERE idUsers = ?`,
        [idFollowed]
      );

      if (!userToFollow) {
        return res.status(404).json({ error: "User not found" });
      }

      await db.runAsync(
        `INSERT INTO Followers (idFollower, idFollowed, followed_date)
         VALUES (?, ?, datetime('now'))`,
        [idFollower, idFollowed]
      );

      await logActivity(db, {
        userId: idFollower,
        username: req.user.username,
        eventType: "follow",
        entityType: "user",
        entityId: idFollowed,
        metadata: { route: "/follow/:idFollowed" },
      });

      return res.status(201).json({
        message: "User followed successfully",
        followedUser: userToFollow,
      });
    } catch (err) {
      if (err && err.message && err.message.includes("UNIQUE")) {
        return res.status(409).json({ error: "Already following this user" });
      }

      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Follow Service - unfollow a user
  app.delete("/follow/:idFollowed", requireAuth, async (req, res) => {
    try {
      const idFollower = req.user.id;
      const idFollowed = Number(req.params.idFollowed);

      if (!idFollowed) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      const result = await db.runAsync(
        `DELETE FROM Followers
         WHERE idFollower = ? AND idFollowed = ?`,
        [idFollower, idFollowed]
      );

      await logActivity(db, {
        userId: idFollower,
        username: req.user.username,
        eventType: "unfollow",
        entityType: "user",
        entityId: idFollowed,
        metadata: { route: "/follow/:idFollowed" },
      });

      return res.json({ message: "User unfollowed successfully" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Follow Service 
  app.get("/following/:userId", requireAuth, async (req, res) => {
    try {
      const userId = Number(req.params.userId);

      const following = await db.allAsync(
        `SELECT Users.idUsers, Users.username, Followers.followed_date
         FROM Followers
         JOIN Users ON Followers.idFollowed = Users.idUsers
         WHERE Followers.idFollower = ?
         ORDER BY Followers.followed_date DESC`,
        [userId]
      );

      return res.json({ following });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Follow Service - get followers of a user
  app.get("/followers/:userId", requireAuth, async (req, res) => {
    try {
      const userId = Number(req.params.userId);

      const followers = await db.allAsync(
        `SELECT Users.idUsers, Users.username, Followers.followed_date
         FROM Followers
         JOIN Users ON Followers.idFollower = Users.idUsers
         WHERE Followers.idFollowed = ?
         ORDER BY Followers.followed_date DESC`,
        [userId]
      );

      return res.json({ followers });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Recipe Service - POST recipe
  app.post("/create", requireAuth, upload.any(), async (req, res) => {
    try {
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
        return res.status(400).json({ errors });
      }

      // Start the transaction into db
      await db.runAsync("BEGIN TRANSACTION");

      // RECIPE
      const userId = req.user.id;
      const recipe = await db.runAsync(
        `INSERT INTO Recipes
        (Users_idUsers, title, description,
         prep_time, cooking_time, num_servings, date_posted)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          userId,
          title,
          description || null,
          prepTime,
          cookingTime,
          numServings
        ]
      );

      const recipeId = recipe.lastID;

      // RECIPE IMAGE
      const recipeImage = req.files.find(file => file.fieldname === "recipeImage");
      if (recipeImage) {
        const media = await db.runAsync(
          `INSERT INTO Media
          (media_url, media_type, upload_date)
          VALUES (?, 'recipe', datetime('now'))`,
          [
            `/uploads/user_${req.user.id}/recipes/${recipeImage.filename}`
          ]
        );

        await db.runAsync(
          `INSERT INTO RecipeMedia
          (Media_idMedia, Recipes_idRecipes)
          VALUES (?, ?)`,
          [
            media.lastID,
            recipeId
          ]
        );
      }

      // INGREDIENTS
      for (let i = 0; i < submittedIngredients.length; i++) {
        const currIngredient = submittedIngredients[i];
        const name = currIngredient.name;
        const quantity = Number(currIngredient.quantity);
        const unit = currIngredient.unit;
        const otherDesc = currIngredient.other_desc;

        let ingredient = await db.getAsync(
          `SELECT idIngredients
          FROM Ingredients
          WHERE name = ?`,
          [name]
        );

        let ingredientId;

        if (!ingredient) {
          const result = await db.runAsync(
            `INSERT INTO Ingredients
            (name)
            VALUES(?)`,
            [name]
          );

          ingredientId = result.lastID;
        }
        else {
          ingredientId = ingredient.idIngredients;
        }

        await db.runAsync(
          `INSERT INTO Recipes_has_Ingredients
          (Recipes_idRecipes, Ingredients_idIngredients, quantity, unit, other_desc)
          VALUES(?, ?, ?, ?, ?)`,
          [
            recipeId,
            ingredientId,
            quantity,
            unit,
            otherDesc || null
          ]
        );

        const ingredientImage = req.files.find(file => file.fieldname === `ingredients[${i}][image]`);

        if (ingredientImage) {
          const media = await db.runAsync(
            `INSERT INTO Media
            (media_url, media_type, upload_date)
            VALUES(?, 'ingredient', datetime('now'))`,
            [
              `/uploads/user_${req.user.id}/ingredients/${ingredientImage.filename}`
            ]
          );

          await db.runAsync(
            `INSERT INTO IngredientMedia
            (Media_idMedia, Ingredients_idIngredients)
            VALUES(?, ?)`,
            [
              media.lastID,
              ingredientId
            ]
          );
        }
      }

      //RECIPE STEPS
      for (const key of stepKeys) {
        const stepIndex = Number(key.replace("step_text_", ""));
        const stepText = req.body[key];

        const stepResult = await db.runAsync(
          `INSERT INTO RecipeSteps
          (Recipes_idRecipes, step_number, instruction_text)
          VALUES(?, ?, ?)`,
          [
            recipeId,
            stepIndex + 1,
            stepText
          ]
        );

        const stepId = stepResult.lastID;

        const stepImage = req.files.find(file => file.fieldname === `step_image_${stepIndex}`);

        if (stepImage) {
          const media = await db.runAsync(
            `INSERT INTO Media
            (media_url, media_type, upload_date)
            VALUES(?, 'step', datetime('now'))`,
            [
              `/uploads/user_${req.user.id}/steps/${stepImage.filename}`
            ]
          );

          await db.runAsync(
            `INSERT INTO RecipeStepMedia
            (Media_idMedia, RecipeSteps_idRecipeSteps)
            VALUES(?, ?)`,
            [
              media.lastID,
              stepId
            ]
          );
        }
      }

      // LOG
      await logActivity(db, {
        userId: req.user.id,
        username: req.user.username,
        eventType: "recipe_create",
        entityType: "recipe",
        entityId: recipeId,
        metadata: { route: "/create" },
      });

      // COMMIT into db
      await db.runAsync("COMMIT");

      return res.status(201).json({
        message: "Posted Recipe successfully",
        recipeId
      });
    } catch (err) {
      try {
        await db.runAsync("ROLLBACK");
      }
      catch (rollbackErr) {
        console.error("Rollback failed: ", rollbackErr);
      }

      console.error("Create Recipe error:", err);
      return res.status(500).json({ error: "Failed to Post Recipe" });
    }
  });

  app.post("/activity", async (req, res) => {
    try {
      await logActivity(db, req.body || {});

      return res.status(201).json({ message: "Activity event logged" });
    } catch (err) {
      return res.status(400).json({ error: err.message || "Invalid activity event" });
    }
  });

  app.get("/analytics/summary", async (req, res) => {
    try {
      return res.json(await getAnalyticsSummary(db));
    } catch (err) {
      console.error(err);

      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/analytics/events", async (req, res) => {
    try {
      const events = await getRecentEvents(db, req.query.limit);

      return res.json({ events });
    } catch (err) {
      console.error(err);

      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/analytics/trending", async (req, res) => {
    try {
      const entities = await getTrendingEntities(db, req.query.days, req.query.limit);

      return res.json({ entities });
    } catch (err) {
      console.error(err);

      return res.status(500).json({ error: "Server error" });
    }
  });

  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`Savr backend listening on http://localhost:${port}`));
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
