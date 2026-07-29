// Integration tests for the Follow Service routes.


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

const PORT = 4600;
const BASE = `http://localhost:${PORT}`;
const stamp = Date.now();

const FOLLOWER = {
  username: `follower_${stamp}`,
  password: "password123",
};

const CREATOR = {
  username: `creator_${stamp}`,
  password: "password123",
};

let tempDb;
let server;
let followerToken;
let followerId;
let creatorId;
let creatorRecipeId;

// SQLite helper used only for test setup.
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

  const followerPassword = bcrypt.hashSync(FOLLOWER.password, 10);
  const creatorPassword = bcrypt.hashSync(CREATOR.password, 10);

  const followerResult = await run(
    db,
    `
    INSERT INTO Users (username, password, account_creation)
    VALUES (?, ?, datetime('now'))
    `,
    [FOLLOWER.username, followerPassword]
  );

  const creatorResult = await run(
    db,
    `
    INSERT INTO Users (username, password, account_creation)
    VALUES (?, ?, datetime('now'))
    `,
    [CREATOR.username, creatorPassword]
  );

  followerId = followerResult.lastID;
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
    VALUES (?, ?, ?, 5, 10, 2, datetime('now'))
    `,
    [
      creatorId,
      "Creator Test Recipe",
      "Recipe used for Follow Service testing",
    ]
  );

  creatorRecipeId = recipeResult.lastID;

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
        JWT_SECRET: "follow-test-secret",
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
      // Server has not started yet.
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
  tempDb = path.join(os.tmpdir(), `savr-follow-test-${stamp}.db`);

  fs.copyFileSync(sourceDb, tempDb);
  await seedDatabase(tempDb);
  await startServer();
  await waitForHealth();

  followerToken = await login(FOLLOWER);
});

after(async () => {
  if (server) {
    server.kill();
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    fs.rmSync(tempDb, { force: true });
  } catch {
    // Harmless if Windows temporarily keeps the file locked.
  }
});

test("authenticated user can follow another user", async () => {
  const response = await api("POST", `/follow/${creatorId}`, {
    token: followerToken,
  });

  assert.equal(response.status, 201);

  const data = await response.json();

  assert.equal(data.message, "User followed successfully");
  assert.equal(data.followedUser.idUsers, creatorId);
  assert.equal(data.followedUser.username, CREATOR.username);
});

test("following feed contains recipes from the followed creator", async () => {
  const response = await api("GET", "/following-feed", {
    token: followerToken,
  });

  assert.equal(response.status, 200);

  const data = await response.json();

  assert.ok(Array.isArray(data.recipes));

  const followedRecipe = data.recipes.find(
    (recipe) => recipe.id === creatorRecipeId
  );

  assert.ok(followedRecipe);
  assert.equal(followedRecipe.creatorId, creatorId);
  assert.equal(followedRecipe.creatorName, CREATOR.username);
  assert.equal(followedRecipe.title, "Creator Test Recipe");
});

test("authenticated user can unfollow and the creator disappears from the feed", async () => {
  const unfollowResponse = await api(
    "DELETE",
    `/follow/${creatorId}`,
    {
      token: followerToken,
    }
  );

  assert.equal(unfollowResponse.status, 200);

  const unfollowData = await unfollowResponse.json();
  assert.equal(
    unfollowData.message,
    "User unfollowed successfully"
  );

  const feedResponse = await api("GET", "/following-feed", {
    token: followerToken,
  });

  assert.equal(feedResponse.status, 200);

  const feedData = await feedResponse.json();

  const creatorRecipes = feedData.recipes.filter(
    (recipe) => recipe.creatorId === creatorId
  );

  assert.equal(creatorRecipes.length, 0);
});