import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import bodyParser from "body-parser";
import cors from "cors";
import bcrypt from "bcryptjs";
import { initDB, getDB } from "./db.js";
import { getAuthenticatedUser, signToken, requireAuth } from "./auth.js";
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
const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Profile image must be a JPG, PNG, WEBP, or GIF file"));
    }

    cb(null, true);
  },
});

function getImageMimeType(buffer) {
  if (!buffer || buffer.length < 12) {
    return "application/octet-stream";
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    return "image/gif";
  }

  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return "application/octet-stream";
}
app.use(
  "/uploads",
  express.static("uploads")
);

function cleanupUploadedFiles(files = []) {
  for (const file of files) {
    if (!file.path) continue;

    try {
      fs.unlinkSync(file.path);
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error("Failed to clean up uploaded file:", file.path, err);
      }
    }
  }
}

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
async function getPublicProfileById(userId) {
  const profile = await db.getAsync(
    `
    SELECT
      idUsers,
      username,
      country,
      gender,
      birthday,
      age,
      CASE
        WHEN profile_image IS NOT NULL THEN 1
        ELSE 0
      END AS hasProfileImage
    FROM Users
    WHERE idUsers = ?
    `,
    [userId]
  );

  if (!profile) {
    return null;
  }

  return {
    ...profile,
    hasProfileImage: Boolean(profile.hasProfileImage),
    profileImageUrl: profile.hasProfileImage
      ? `/users/${profile.idUsers}/profile-image`
      : null,
  };
}
  // Get the currently authenticated user's profile
app.get("/profile", requireAuth, async (req, res) => {
  try {
    const profile = await getPublicProfileById(req.user.id);

    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(profile);
  } catch (err) {
    console.error("Profile fetch error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
// Get another user's public profile
app.get("/users/:id/profile", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!userId) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const profile = await getPublicProfileById(userId);

    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(profile);
  } catch (err) {
    console.error("Public profile fetch error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
  // Update the authenticated user's profile
app.put("/profile", requireAuth, async (req, res) => {
  try {
    const {
      username,
      country,
      gender,
      birthday,
      age,
    } = req.body;

    if (!username || username.trim() === "") {
      return res.status(400).json({
        error: "Username is required",
      });
    }

    if (
      gender &&
      !["male", "female", "other"].includes(gender)
    ) {
      return res.status(400).json({
        error: "Invalid gender",
      });
    }

    if (age !== null && age !== undefined) {
      const parsedAge = Number(age);

      if (!Number.isInteger(parsedAge) || parsedAge < 16) {
        return res.status(400).json({
          error: "Age must be at least 16",
        });
      }
    }

    const existing = await db.getAsync(
      `
      SELECT idUsers
      FROM Users
      WHERE username = ?
      AND idUsers != ?
      `,
      [username.trim(), req.user.id]
    );

    if (existing) {
      return res.status(409).json({
        error: "Username already exists",
      });
    }

    await db.runAsync(
      `
      UPDATE Users
      SET
        username = ?,
        country = ?,
        gender = ?,
        birthday = ?,
        age = ?
      WHERE idUsers = ?
      `,
      [
        username.trim(),
        country || null,
        gender || null,
        birthday || null,
        age || null,
        req.user.id,
      ]
    );

    const updated = await getPublicProfileById(req.user.id);

      return res.json(updated);

  } catch (err) {

    console.error("Profile update error:", err);

    return res.status(500).json({
      error: "Server error",
    });

  }
});
// Upload or replace the authenticated user's profile image
app.post("/profile/image", requireAuth, (req, res) => {
  profileImageUpload.single("profileImage")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        error: err.message || "Invalid profile image",
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No profile image uploaded",
        });
      }

      await db.runAsync(
        `
        UPDATE Users
        SET profile_image = ?
        WHERE idUsers = ?
        `,
        [req.file.buffer, req.user.id]
      );

      const updated = await getPublicProfileById(req.user.id);

      return res.json(updated);
    } catch (dbErr) {
      console.error("Profile image upload error:", dbErr);
      return res.status(500).json({
        error: "Unable to upload profile image",
      });
    }
  });
});

// Public route for viewing a user's profile image
app.get("/users/:id/profile-image", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!userId) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const row = await db.getAsync(
      `
      SELECT profile_image
      FROM Users
      WHERE idUsers = ?
      `,
      [userId]
    );

    if (!row || !row.profile_image) {
      return res.status(404).json({ error: "Profile image not found" });
    }

    const contentType = getImageMimeType(row.profile_image);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");

    return res.send(row.profile_image);
  } catch (err) {
    console.error("Profile image fetch error:", err);
    return res.status(500).json({ error: "Unable to load profile image" });
  }
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
  // Follow Service - check if current user follows another user
  app.get("/follow/status/:idFollowed", requireAuth, async (req, res) => {
    try {
      const idFollower = req.user.id;
      const idFollowed = Number(req.params.idFollowed);

      if (!idFollowed) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      const follow = await db.getAsync(
        `SELECT idFollower, idFollowed
         FROM Followers
         WHERE idFollower = ? AND idFollowed = ?`,
        [idFollower, idFollowed]
      );

      return res.json({ isFollowing: Boolean(follow) });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Follow Service - get follower/following counts
  app.get("/follow/counts/:userId", requireAuth, async (req, res) => {
    try {
      const userId = Number(req.params.userId);

      if (!userId) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      const followersResult = await db.getAsync(
        `SELECT COUNT(*) AS count
         FROM Followers
         WHERE idFollowed = ?`,
        [userId]
      );

      const followingResult = await db.getAsync(
        `SELECT COUNT(*) AS count
         FROM Followers
         WHERE idFollower = ?`,
        [userId]
      );

      return res.json({
        followersCount: followersResult.count,
        followingCount: followingResult.count,
      });
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
        cleanupUploadedFiles(req.files);
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
      cleanupUploadedFiles(req.files);

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

  async function getOptionalUserId(req) {
    try {
      const user = await getAuthenticatedUser(req);
      return user?.idUsers || null;
    } catch {
      return null;
    }
  }

  app.get("/recipes", async (req, res) => {
    try {
      const viewerId = await getOptionalUserId(req);
      const recipes = await db.allAsync(`
        SELECT
          Recipes.idRecipes AS id,
          Recipes.title,
          Recipes.description,
          Recipes.prep_time AS prepTime,
          Recipes.cooking_time AS cookingTime,
          Recipes.num_servings AS numServings,
          Recipes.date_posted AS datePosted,
          Users.idUsers AS creatorId,
          Users.username AS creatorName,
          CASE
            WHEN Users.profile_image IS NOT NULL THEN '/users/' || Users.idUsers || '/profile-image'
            ELSE NULL
          END AS creatorProfileImageUrl,
          (
            SELECT Media.media_url
            FROM RecipeMedia
            JOIN Media ON RecipeMedia.Media_idMedia = Media.idMedia
            WHERE RecipeMedia.Recipes_idRecipes = Recipes.idRecipes
            ORDER BY Media.display_order ASC, Media.idMedia ASC
            LIMIT 1
          ) AS imageUrl,
          (
            SELECT COUNT(*)
            FROM Comments
            WHERE Comments.Recipes_idRecipes = Recipes.idRecipes
          ) AS commentCount,
          (
            SELECT ROUND(AVG(Ratings.num_stars), 1)
            FROM Ratings
            WHERE Ratings.Recipes_idRecipes = Recipes.idRecipes
          ) AS averageRating,
          CASE
            WHEN ? IS NOT NULL AND EXISTS (
              SELECT 1
              FROM SavedRecipes
              WHERE SavedRecipes.Recipes_idRecipes = Recipes.idRecipes
                AND SavedRecipes.Users_idUsers = ?
            )
            THEN 1
            ELSE 0
          END AS isSaved
        FROM Recipes
        JOIN Users ON Recipes.Users_idUsers = Users.idUsers
        ORDER BY datetime(Recipes.date_posted) DESC, Recipes.idRecipes DESC
      `, [viewerId, viewerId]);

      return res.json({ recipes });
    } catch (err) {
      console.error("Recipe feed error:", err);
      return res.status(500).json({ error: "Unable to load recipes" });
    }
  });

  app.get("/recipes/:id", async (req, res) => {
    try {
      const recipeId = Number(req.params.id);
      const viewerId = await getOptionalUserId(req);

      if (!recipeId) {
        return res.status(400).json({ error: "Invalid recipe id" });
      }

      const recipe = await db.getAsync(
        `
          SELECT
            Recipes.idRecipes AS id,
            Recipes.title,
            Recipes.description,
            Recipes.prep_time AS prepTime,
            Recipes.cooking_time AS cookingTime,
            Recipes.num_servings AS numServings,
            Recipes.date_posted AS datePosted,
            Users.idUsers AS creatorId,
            Users.username AS creatorName,
            CASE
              WHEN Users.profile_image IS NOT NULL THEN '/users/' || Users.idUsers || '/profile-image'
              ELSE NULL
            END AS creatorProfileImageUrl,
            (
              SELECT Media.media_url
              FROM RecipeMedia
              JOIN Media ON RecipeMedia.Media_idMedia = Media.idMedia
              WHERE RecipeMedia.Recipes_idRecipes = Recipes.idRecipes
              ORDER BY Media.display_order ASC, Media.idMedia ASC
              LIMIT 1
            ) AS imageUrl,
            (
              SELECT ROUND(AVG(Ratings.num_stars), 1)
              FROM Ratings
              WHERE Ratings.Recipes_idRecipes = Recipes.idRecipes
            ) AS averageRating,
            (
              SELECT COUNT(*)
              FROM Ratings
              WHERE Ratings.Recipes_idRecipes = Recipes.idRecipes
            ) AS ratingCount,
            (
              SELECT num_stars
              FROM Ratings
              WHERE Ratings.Recipes_idRecipes = Recipes.idRecipes
                AND Ratings.Users_idUsers = ?
            ) AS userRating,
            CASE
              WHEN ? IS NOT NULL AND EXISTS (
                SELECT 1
                FROM SavedRecipes
                WHERE SavedRecipes.Recipes_idRecipes = Recipes.idRecipes
                  AND SavedRecipes.Users_idUsers = ?
              )
              THEN 1
              ELSE 0
            END AS isSaved
          FROM Recipes
          JOIN Users ON Recipes.Users_idUsers = Users.idUsers
          WHERE Recipes.idRecipes = ?
        `,
        [viewerId, viewerId, viewerId, recipeId]
      );

      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      const ingredients = await db.allAsync(
        `
          SELECT
            Ingredients.idIngredients AS id,
            Ingredients.name,
            Recipes_has_Ingredients.quantity,
            Recipes_has_Ingredients.unit,
            Recipes_has_Ingredients.other_desc AS otherDesc,
            (
              SELECT Media.media_url
              FROM IngredientMedia
              JOIN Media ON IngredientMedia.Media_idMedia = Media.idMedia
              WHERE IngredientMedia.Ingredients_idIngredients = Ingredients.idIngredients
              ORDER BY Media.display_order ASC, Media.idMedia ASC
              LIMIT 1
            ) AS imageUrl
          FROM Recipes_has_Ingredients
          JOIN Ingredients
            ON Recipes_has_Ingredients.Ingredients_idIngredients = Ingredients.idIngredients
          WHERE Recipes_has_Ingredients.Recipes_idRecipes = ?
          ORDER BY Ingredients.name ASC
        `,
        [recipeId]
      );

      const steps = await db.allAsync(
        `
          SELECT
            RecipeSteps.idRecipeSteps AS id,
            RecipeSteps.step_number AS stepNumber,
            RecipeSteps.instruction_text AS instructionText,
            (
              SELECT Media.media_url
              FROM RecipeStepMedia
              JOIN Media ON RecipeStepMedia.Media_idMedia = Media.idMedia
              WHERE RecipeStepMedia.RecipeSteps_idRecipeSteps = RecipeSteps.idRecipeSteps
              ORDER BY Media.display_order ASC, Media.idMedia ASC
              LIMIT 1
            ) AS imageUrl
          FROM RecipeSteps
          WHERE RecipeSteps.Recipes_idRecipes = ?
          ORDER BY RecipeSteps.step_number ASC
        `,
        [recipeId]
      );

      const comments = await db.allAsync(
        `
          SELECT
            Comments.idComments AS id,
            Comments.description,
            Comments.date_posted AS datePosted,
            Users.idUsers AS creatorId,
            Users.username AS creatorName
          FROM Comments
          JOIN Users ON Comments.Users_idUsers = Users.idUsers
          WHERE Comments.Recipes_idRecipes = ?
          ORDER BY datetime(Comments.date_posted) DESC, Comments.idComments DESC
        `,
        [recipeId]
      );

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
  });

  app.get("/saved-recipes", requireAuth, async (req, res) => {
    try {
      const recipes = await db.allAsync(
        `
          SELECT
            Recipes.idRecipes AS id,
            Recipes.title,
            Recipes.description,
            Recipes.prep_time AS prepTime,
            Recipes.cooking_time AS cookingTime,
            Recipes.num_servings AS numServings,
            Recipes.date_posted AS datePosted,
            Users.idUsers AS creatorId,
            Users.username AS creatorName,
            CASE
              WHEN Users.profile_image IS NOT NULL THEN '/users/' || Users.idUsers || '/profile-image'
              ELSE NULL
            END AS creatorProfileImageUrl,
            SavedRecipes.bookmarked_date AS bookmarkedDate,
            1 AS isSaved,
            (
              SELECT Media.media_url
              FROM RecipeMedia
              JOIN Media ON RecipeMedia.Media_idMedia = Media.idMedia
              WHERE RecipeMedia.Recipes_idRecipes = Recipes.idRecipes
              ORDER BY Media.display_order ASC, Media.idMedia ASC
              LIMIT 1
            ) AS imageUrl,
            (
              SELECT COUNT(*)
              FROM Comments
              WHERE Comments.Recipes_idRecipes = Recipes.idRecipes
            ) AS commentCount,
            (
              SELECT ROUND(AVG(Ratings.num_stars), 1)
              FROM Ratings
              WHERE Ratings.Recipes_idRecipes = Recipes.idRecipes
            ) AS averageRating
          FROM SavedRecipes
          JOIN Recipes ON SavedRecipes.Recipes_idRecipes = Recipes.idRecipes
          JOIN Users ON Recipes.Users_idUsers = Users.idUsers
          WHERE SavedRecipes.Users_idUsers = ?
          ORDER BY datetime(SavedRecipes.bookmarked_date) DESC, Recipes.idRecipes DESC
        `,
        [req.user.id]
      );

      return res.json({ recipes });
    } catch (err) {
      console.error("Saved recipes error:", err);
      return res.status(500).json({ error: "Unable to load saved recipes" });
    }
  });

  // Comments longer than this are rejected on both create and edit.
  const MAX_COMMENT_LENGTH = 1000;

  app.post("/recipes/:id/comments", requireAuth, async (req, res) => {
    try {
      const recipeId = Number(req.params.id);
      const description = (req.body?.description || "").trim();

      if (!recipeId) {
        return res.status(400).json({ error: "Invalid recipe id" });
      }

      if (!description) {
        return res.status(400).json({ error: "Comment cannot be empty" });
      }

      if (description.length > MAX_COMMENT_LENGTH) {
        return res.status(400).json({
          error: `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`,
        });
      }

      const recipe = await db.getAsync(
        `SELECT idRecipes FROM Recipes WHERE idRecipes = ?`,
        [recipeId]
      );

      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      const commentResult = await db.runAsync(
        `INSERT INTO Comments (Recipes_idRecipes, Users_idUsers, description, date_posted)
         VALUES (?, ?, ?, datetime('now'))`,
        [recipeId, req.user.id, description]
      );

      await logActivity(db, {
        userId: req.user.id,
        username: req.user.username,
        eventType: "comment_create",
        entityType: "comment",
        entityId: commentResult.lastID,
        metadata: { route: "/recipes/:id/comments" },
      });

      return res.status(201).json({
        message: "Comment posted successfully",
        comment: {
          id: commentResult.lastID,
          description,
          creatorId: req.user.id,
          creatorName: req.user.username,
          datePosted: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error("Comment create error:", err);
      return res.status(500).json({ error: "Unable to post comment" });
    }
  });

  // Edit a comment. Only the comment's author may edit it (checked server-side).
  app.put("/recipes/:id/comments/:commentId", requireAuth, async (req, res) => {
    try {
      const recipeId = Number(req.params.id);
      const commentId = Number(req.params.commentId);
      const description = (req.body?.description || "").trim();

      if (!recipeId || !commentId) {
        return res.status(400).json({ error: "Invalid recipe or comment id" });
      }

      if (!description) {
        return res.status(400).json({ error: "Comment cannot be empty" });
      }

      if (description.length > MAX_COMMENT_LENGTH) {
        return res.status(400).json({
          error: `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`,
        });
      }

      const comment = await db.getAsync(
        `SELECT idComments, Users_idUsers, Recipes_idRecipes, date_posted
         FROM Comments WHERE idComments = ?`,
        [commentId]
      );

      if (!comment || comment.Recipes_idRecipes !== recipeId) {
        return res.status(404).json({ error: "Comment not found" });
      }

      if (comment.Users_idUsers !== req.user.id) {
        return res.status(403).json({ error: "You can only edit your own comment" });
      }

      await db.runAsync(
        `UPDATE Comments SET description = ? WHERE idComments = ?`,
        [description, commentId]
      );

      await logActivity(db, {
        userId: req.user.id,
        username: req.user.username,
        eventType: "comment_edit",
        entityType: "comment",
        entityId: commentId,
        metadata: { route: "/recipes/:id/comments/:commentId" },
      });

      return res.json({
        message: "Comment updated successfully",
        comment: {
          id: commentId,
          description,
          creatorId: req.user.id,
          creatorName: req.user.username,
          datePosted: comment.date_posted,
        },
      });
    } catch (err) {
      console.error("Comment edit error:", err);
      return res.status(500).json({ error: "Unable to update comment" });
    }
  });

  // Delete a comment. Only the comment's author may delete it (checked server-side).
  app.delete("/recipes/:id/comments/:commentId", requireAuth, async (req, res) => {
    try {
      const recipeId = Number(req.params.id);
      const commentId = Number(req.params.commentId);

      if (!recipeId || !commentId) {
        return res.status(400).json({ error: "Invalid recipe or comment id" });
      }

      const comment = await db.getAsync(
        `SELECT idComments, Users_idUsers, Recipes_idRecipes
         FROM Comments WHERE idComments = ?`,
        [commentId]
      );

      if (!comment || comment.Recipes_idRecipes !== recipeId) {
        return res.status(404).json({ error: "Comment not found" });
      }

      if (comment.Users_idUsers !== req.user.id) {
        return res.status(403).json({ error: "You can only delete your own comment" });
      }

      await db.runAsync(`DELETE FROM Comments WHERE idComments = ?`, [commentId]);

      await logActivity(db, {
        userId: req.user.id,
        username: req.user.username,
        eventType: "comment_delete",
        entityType: "comment",
        entityId: commentId,
        metadata: { route: "/recipes/:id/comments/:commentId" },
      });

      return res.json({ message: "Comment deleted successfully", id: commentId });
    } catch (err) {
      console.error("Comment delete error:", err);
      return res.status(500).json({ error: "Unable to delete comment" });
    }
  });

  app.post("/recipes/:id/rating", requireAuth, async (req, res) => {
    try {
      const recipeId = Number(req.params.id);
      const stars = Number(req.body?.stars);

      if (!recipeId) {
        return res.status(400).json({ error: "Invalid recipe id" });
      }

      if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }

      const recipe = await db.getAsync(
        `SELECT idRecipes FROM Recipes WHERE idRecipes = ?`,
        [recipeId]
      );

      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      const result = await db.runAsync(
        `INSERT INTO Ratings (Recipes_idRecipes, Users_idUsers, num_stars, date_posted)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(Recipes_idRecipes, Users_idUsers) DO UPDATE SET
           num_stars = excluded.num_stars,
           date_posted = datetime('now')`,
        [recipeId, req.user.id, stars]
      );

      await logActivity(db, {
        userId: req.user.id,
        username: req.user.username,
        eventType: "rating_submit",
        entityType: "rating",
        entityId: recipeId,
        metadata: { route: "/recipes/:id/rating" },
      });

      const summary = await db.getAsync(
        `SELECT ROUND(AVG(num_stars), 1) AS averageRating, COUNT(*) AS ratingCount
         FROM Ratings
         WHERE Recipes_idRecipes = ?`,
        [recipeId]
      );

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
  });

  app.post("/recipes/:id/save", requireAuth, async (req, res) => {
    try {
      const recipeId = Number(req.params.id);

      if (!recipeId) {
        return res.status(400).json({ error: "Invalid recipe id" });
      }

      const recipe = await db.getAsync(
        `SELECT idRecipes FROM Recipes WHERE idRecipes = ?`,
        [recipeId]
      );

      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      await db.runAsync(
        `INSERT OR IGNORE INTO SavedRecipes
         (Users_idUsers, Recipes_idRecipes, bookmarked_date)
         VALUES (?, ?, datetime('now'))`,
        [req.user.id, recipeId]
      );

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
  });

  app.delete("/recipes/:id/save", requireAuth, async (req, res) => {
    try {
      const recipeId = Number(req.params.id);

      if (!recipeId) {
        return res.status(400).json({ error: "Invalid recipe id" });
      }

      await db.runAsync(
        `DELETE FROM SavedRecipes
         WHERE Users_idUsers = ? AND Recipes_idRecipes = ?`,
        [req.user.id, recipeId]
      );

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
