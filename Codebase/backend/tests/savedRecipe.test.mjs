// Integration tests for the Saved Recipe Service routes.


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

const PORT = 4601;
const BASE = `http://localhost:${PORT}`;
const stamp = Date.now();

const TEST_USER = {
  username: `saved_user_${stamp}`,
  password: "password123",
};

const CREATOR = {
  username: `saved_creator_${stamp}`,
  password: "password123",
};

let tempDb;
let server;
let userToken;
let userId;
let creatorId;
let recipeId;

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

async function seedDatabase(dbPath) {
  const db = new sqlite3.Database(dbPath);

  const userPassword = bcrypt.hashSync(TEST_USER.password, 10);
  const creatorPassword = bcrypt.hashSync(CREATOR.password, 10);

  const userResult = await run(
    db,
    `
    INSERT INTO Users (username, password, account_creation)
    VALUES (?, ?, datetime('now'))
    `,
    [TEST_USER.username, userPassword]
  );

  const creatorResult = await run(
    db,
    `
    INSERT INTO Users (username, password, account_creation)
    VALUES (?, ?, datetime('now'))
    `,
    [CREATOR.username, creatorPassword]
  );

  userId = userResult.lastID;
  creatorId = creatorResult.lastID;

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
    VALUES (?, ?, ?, 10, 20, 4, datetime('now'))
    `,
    [
      creatorId,
      "Saved Recipe Test",
      "Recipe created for Saved Recipe Service testing",
    ]
  );

  recipeId = recipeResult.lastID;

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
        JWT_SECRET: "saved-recipe-test-secret",
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
  tempDb = path.join(
    os.tmpdir(),
    `savr-saved-recipe-test-${stamp}.db`
  );

  fs.copyFileSync(sourceDb, tempDb);
  await seedDatabase(tempDb);
  await startServer();
  await waitForHealth();

  userToken = await login(TEST_USER);
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

test("authenticated user can save a recipe", async () => {
  const response = await api(
    "POST",
    `/recipes/${recipeId}/save`,
    {
      token: userToken,
    }
  );

  assert.equal(response.status, 200);

  const data = await response.json();
  assert.equal(data.saved, true);
});

test("saved recipes list contains the saved recipe", async () => {
  const response = await api("GET", "/saved-recipes", {
    token: userToken,
  });

  assert.equal(response.status, 200);

  const data = await response.json();

  assert.ok(Array.isArray(data.recipes));

  const savedRecipe = data.recipes.find(
    (recipe) => recipe.id === recipeId
  );

  assert.ok(savedRecipe);
  assert.equal(savedRecipe.title, "Saved Recipe Test");
  assert.equal(savedRecipe.creatorId, creatorId);
  assert.equal(savedRecipe.creatorName, CREATOR.username);
  assert.equal(savedRecipe.isSaved, 1);
});

test("authenticated user can unsave a recipe and it disappears from saved recipes", async () => {
  const unsaveResponse = await api(
    "DELETE",
    `/recipes/${recipeId}/save`,
    {
      token: userToken,
    }
  );

  assert.equal(unsaveResponse.status, 200);

  const unsaveData = await unsaveResponse.json();
  assert.equal(unsaveData.saved, false);

  const listResponse = await api("GET", "/saved-recipes", {
    token: userToken,
  });

  assert.equal(listResponse.status, 200);

  const listData = await listResponse.json();

  const matchingRecipes = listData.recipes.filter(
    (recipe) => recipe.id === recipeId
  );

  assert.equal(matchingRecipes.length, 0);
});