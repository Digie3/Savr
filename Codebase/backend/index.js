import "dotenv/config";
import express from "express";
import multer from "multer";
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
    cb(null, "uploads/");
  },

  filename: function (req, file, cb) {
    cb(
      null,
      Date.now() + "-" + file.originalname
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

      //Correctness Checks
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }
      else if (title.length > 100) {
        return res.status(400).json({ error: "Title can have at most 100 characters" });
      }

      if (description && description.length > 1000) {
        return res.status(400).json({ error: "Description can have at most 1000 characters" });
      }

      if (Number.isNaN(prepTime)) {
        return res.status(400).json({ error: "Prep time is required" });
      }
      else if (prepTime < 0) {
        return res.status(400).json({ error: "Preparation time cannot be negative" });
      }

      if (Number.isNaN(cookingTime)) {
        return res.status(400).json({ error: "Cooking time is required" });
      }
      else if (cookingTime < 0) {
        return res.status(400).json({ error: "Cooking time cannot be negative" });
      }

      if (Number.isNaN(numServings)) {
        return res.status(400).json({ error: "Number of servings is required" });
      }
      else if (numServings < 1) {
        return res.status(400).json({ error: "Number of Servings must be at least 1 servings" });
      }

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

      // RECIPE IMAGE
      const recipeImage = req.files.find(file => file.fieldname === "recipeImage");

      if (recipeImage) {
        const media = await db.runAsync(
          `INSERT INTO Media
          (media_url, media_type, upload_date)
          VALUES (?, 'recipe', datetime('now'))`,
          [
            `/uploads/${recipeImage.filename}`
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
      const ingredientIndexes = new Set();

      Object.keys(req.body).forEach(key => {
        const match = key.match(/^ingredients\[(\d+)\]\[name\]$/);

        if (match) {
          ingredientIndexes.add(
            Number(match[1])
          );
        }
      });

      for (const index of ingredientIndexes) {
        const name = req.body[`ingredients[${index}][name]`];
        const quantity = Number(
          req.body[`ingredients[${index}][quantity]`]
        );
        const unit = req.body[`ingredients[${index}][unit]`];
        const otherDesc =
          req.body[`ingredients[${index}][other_desc]`];

        if (!name) continue;

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

        const ingredientImage = req.files.find(file => file.fieldname === `ingredients[${index}][image]`);

        if (ingredientImage) {
          const media = await db.runAsync(
            `INSERT INTO Media
            (media_url, media_type, upload_date)
            VALUES(?, 'ingredient', datetime('now'))`,
            [
              `/uploads/${ingredientImage.filename}`
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
      const stepKeys = Object.keys(req.body).filter(key => key.startsWith("step_text_"));

      for (const key of stepKeys) {
        const stepIndex = Number(key.replace("step_text_", ""));
        const stepText = req.body[key];

        //Correctness Checks 
        if (!stepText) {
          return res.status(400).json({error: `Step ${stepNumber + 1} is required`});
        }
        else if (stepText.length > 500) {
          return res.status(400).json({
            error: `Step ${stepNumber + 1} can have at most 500 characters`});
        }

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
              `/uploads/${stepImage.filename}`
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
      const recipeId = recipe.lastID;
      await logActivity(db, {
        userId: req.user.id,
        username: req.user.username,
        eventType: "recipe_create",
        entityType: "recipe",
        entityId: recipeId,
        metadata: { route: "/create" },
      });

      return res.status(201).json({
        message: "Posted Recipe successfully",
        recipeId
      });
    } catch (err) {
      console.error(err);
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
