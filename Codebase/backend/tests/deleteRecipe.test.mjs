// Integration tests for the Delete Recipe route.

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..");

const sourceDb = path.resolve(
  backendDir,
  "..",
  "..",
  "Database",
  "relational_database",
  "v.3.0",
  "recipe_social_media.db"
);

const PORT = 4603;
const BASE = `http://localhost:${PORT}`;
const stamp = Date.now();

const OWNER = {
  username: `delete_owner_${stamp}`,
  password: "password123",
};

const OTHER_USER = {
  username: `delete_other_${stamp}`,
  password: "password123",
};

let tempDb;
let server;
let ownerToken;
let otherToken;
let ownerId;
let recipeToDeleteId;
let protectedRecipeId;

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

function closeDb(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function seedRecipe(db, title) {
  const recipeResult = await run(
    db,
    `
    INSERT INTO Recipes (
      Users_idUsers,
      title,
      description,
      prep_time,
      cooking_time,
      num_servings,
      date_posted
    )
    VALUES (?, ?, ?, 5, 10, 2, datetime('now'))
    `,
    [ownerId, title, `${title} description`]
  );

  const recipeId = recipeResult.lastID;

  const ingredientResult = await run(
    db,
    `
    INSERT INTO Ingredients (name)
    VALUES (?)
    `,
    [`ingredient_${recipeId}_${stamp}`]
  );

  await run(
    db,
    `
    INSERT INTO Recipes_has_Ingredients (
      Recipes_idRecipes,
      Ingredients_idIngredients,
      quantity,
      unit
    )
    VALUES (?, ?, 1, 'cup')
    `,
    [recipeId, ingredientResult.lastID]
  );

  await run(
    db,
    `
    INSERT INTO RecipeSteps (
      Recipes_idRecipes,
      step_number,
      instruction_text
    )
    VALUES (?, 1, ?)
    `,
    [recipeId, `Prepare ${title}`]
  );

  return recipeId;
}

async function seedDatabase(dbPath) {
  const db = new sqlite3.Database(dbPath);

  const ownerPassword = bcrypt.hashSync(OWNER.password, 10);
  const otherPassword = bcrypt.hashSync(OTHER_USER.password, 10);

  const ownerResult = await run(
    db,
    `
    INSERT INTO Users (username, password, account_creation)
    VALUES (?, ?, datetime('now'))
    `,
    [OWNER.username, ownerPassword]
  );

  await run(
    db,
    `
    INSERT INTO Users (username, password, account_creation)
    VALUES (?, ?, datetime('now'))
    `,
    [OTHER_USER.username, otherPassword]
  );

  ownerId = ownerResult.lastID;
  recipeToDeleteId = await seedRecipe(db, "Recipe Owner Can Delete");
  protectedRecipeId = await seedRecipe(db, "Recipe Other User Cannot Delete");

  await closeDb(db);
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, ["index.js"], {
      cwd: backendDir,
      env: {
        ...process.env,
        SAVR_DB_PATH: tempDb,
        PORT: String(PORT),
        JWT_SECRET: "delete-recipe-test-secret",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    server.on("error", reject);
    resolve();
  });
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // Server is not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error("Server did not become healthy in time");
}

function api(method, url, { token, body } = {}) {
  return fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function login(user) {
  const response = await api("POST", "/login", {
    body: user,
  });

  assert.equal(response.status, 200);

  const data = await response.json();
  return data.token;
}

before(async () => {
  tempDb = path.join(os.tmpdir(), `savr-delete-recipe-test-${stamp}.db`);

  fs.copyFileSync(sourceDb, tempDb);
  await seedDatabase(tempDb);
  await startServer();
  await waitForHealth();

  ownerToken = await login(OWNER);
  otherToken = await login(OTHER_USER);
});

after(async () => {
  if (server) {
    server.kill();
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    fs.rmSync(tempDb, { force: true });
  } catch {
    // Harmless if the temporary file is still locked.
  }
});

test("recipe owner can delete their recipe", async () => {
  const deleteResponse = await api("DELETE", `/recipes/${recipeToDeleteId}`, {
    token: ownerToken,
  });

  assert.equal(deleteResponse.status, 200);

  const deleteData = await deleteResponse.json();
  assert.equal(deleteData.message, "Recipe deleted successfully");
  assert.equal(deleteData.recipeId, recipeToDeleteId);

  const detailResponse = await api("GET", `/recipes/${recipeToDeleteId}`, {
    token: ownerToken,
  });

  assert.equal(detailResponse.status, 404);

  const detailData = await detailResponse.json();
  assert.equal(detailData.error, "Recipe not found");
});

test("different user cannot delete someone else's recipe", async () => {
  const deleteResponse = await api("DELETE", `/recipes/${protectedRecipeId}`, {
    token: otherToken,
  });

  assert.equal(deleteResponse.status, 403);

  const deleteData = await deleteResponse.json();
  assert.equal(deleteData.error, "You can only delete your own recipes");

  const detailResponse = await api("GET", `/recipes/${protectedRecipeId}`, {
    token: ownerToken,
  });

  assert.equal(detailResponse.status, 200);

  const detailData = await detailResponse.json();
  assert.equal(detailData.recipe.id, protectedRecipeId);
  assert.equal(detailData.recipe.creatorId, ownerId);
  assert.equal(detailData.recipe.title, "Recipe Other User Cannot Delete");
});
