// Integration tests for the Comment & Rating routes.
// Runs the real Express server against a throwaway copy of the v3.0 database
// (via SAVR_DB_PATH) so the committed database is never touched.
//
// Run with:  npm test   (from Codebase/backend)

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

const PORT = 4599;
const BASE = `http://localhost:${PORT}`;
const stamp = Date.now();
const USER_A = { username: `alice_${stamp}`, password: "password123" };
const USER_B = { username: `bob_${stamp}`, password: "password123" };

let tempDb;
let server;
let tokenA;
let tokenB;
let idA;
let recipeId;
let ownedCommentId;

// --- tiny sqlite promise helpers (setup only) ---
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function closeDb(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

async function seedDatabase(dbPath) {
  const db = new sqlite3.Database(dbPath);
  const hashA = bcrypt.hashSync(USER_A.password, 10);
  const hashB = bcrypt.hashSync(USER_B.password, 10);

  const a = await run(
    db,
    `INSERT INTO Users (username, password, account_creation) VALUES (?, ?, datetime('now'))`,
    [USER_A.username, hashA]
  );
  await run(
    db,
    `INSERT INTO Users (username, password, account_creation) VALUES (?, ?, datetime('now'))`,
    [USER_B.username, hashB]
  );
  idA = a.lastID;

  const recipe = await run(
    db,
    `INSERT INTO Recipes (Users_idUsers, title, description, prep_time, cooking_time, num_servings, date_posted)
     VALUES (?, 'Test Recipe', 'seeded for tests', 5, 10, 2, datetime('now'))`,
    [idA]
  );
  recipeId = recipe.lastID;

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
        JWT_SECRET: "test-secret",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.on("error", reject);
    resolve();
  });
}

async function waitForHealth() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return;
    } catch {
      // server not up yet
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
  const response = await api("POST", "/login", { body: user });
  const data = await response.json();
  return data.token;
}

before(async () => {
  tempDb = path.join(os.tmpdir(), `savr-test-${stamp}.db`);
  fs.copyFileSync(sourceDb, tempDb);
  await seedDatabase(tempDb);
  await startServer();
  await waitForHealth();
  tokenA = await login(USER_A);
  tokenB = await login(USER_B);
});

after(async () => {
  if (server) server.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
  try {
    fs.rmSync(tempDb, { force: true });
  } catch {
    // temp file may still be locked on Windows; harmless if left behind
  }
});

// --- Comments ---

test("rejects unauthenticated comment creation", async () => {
  const res = await api("POST", `/recipes/${recipeId}/comments`, {
    body: { description: "hello" },
  });
  assert.equal(res.status, 401);
});

test("rejects an empty / whitespace-only comment", async () => {
  const res = await api("POST", `/recipes/${recipeId}/comments`, {
    token: tokenA,
    body: { description: "   " },
  });
  assert.equal(res.status, 400);
});

test("rejects an overly long comment", async () => {
  const res = await api("POST", `/recipes/${recipeId}/comments`, {
    token: tokenA,
    body: { description: "x".repeat(1001) },
  });
  assert.equal(res.status, 400);
});

test("creates a valid comment", async () => {
  const res = await api("POST", `/recipes/${recipeId}/comments`, {
    token: tokenA,
    body: { description: "Great recipe" },
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.comment.description, "Great recipe");
  assert.equal(data.comment.creatorId, idA);
  ownedCommentId = data.comment.id;
});

test("commenting on a nonexistent recipe returns 404", async () => {
  const res = await api("POST", `/recipes/999999/comments`, {
    token: tokenA,
    body: { description: "hello" },
  });
  assert.equal(res.status, 404);
});

test("the comment owner can edit their comment", async () => {
  const res = await api("PUT", `/recipes/${recipeId}/comments/${ownedCommentId}`, {
    token: tokenA,
    body: { description: "Edited text" },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.comment.description, "Edited text");
});

test("a different user cannot edit someone else's comment", async () => {
  const res = await api("PUT", `/recipes/${recipeId}/comments/${ownedCommentId}`, {
    token: tokenB,
    body: { description: "Hacked" },
  });
  assert.equal(res.status, 403);
});

test("editing a nonexistent comment returns 404", async () => {
  const res = await api("PUT", `/recipes/${recipeId}/comments/999999`, {
    token: tokenA,
    body: { description: "nope" },
  });
  assert.equal(res.status, 404);
});

test("a different user cannot delete someone else's comment", async () => {
  const res = await api("DELETE", `/recipes/${recipeId}/comments/${ownedCommentId}`, {
    token: tokenB,
  });
  assert.equal(res.status, 403);
});

test("the comment owner can delete their comment", async () => {
  const res = await api("DELETE", `/recipes/${recipeId}/comments/${ownedCommentId}`, {
    token: tokenA,
  });
  assert.equal(res.status, 200);
});

// --- Ratings ---

test("rejects an unauthenticated rating", async () => {
  const res = await api("POST", `/recipes/${recipeId}/rating`, { body: { stars: 4 } });
  assert.equal(res.status, 401);
});

test("rejects ratings outside 1-5 (including decimals and strings)", async () => {
  for (const stars of [0, 6, 2.5, "abc"]) {
    const res = await api("POST", `/recipes/${recipeId}/rating`, {
      token: tokenA,
      body: { stars },
    });
    assert.equal(res.status, 400, `stars=${stars} should be rejected`);
  }
});

test("submits a valid rating and returns average + count", async () => {
  const res = await api("POST", `/recipes/${recipeId}/rating`, {
    token: tokenA,
    body: { stars: 4 },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.rating.stars, 4);
  assert.equal(data.rating.ratingCount, 1);
  assert.equal(data.rating.averageRating, 4);
});

test("re-rating updates the existing row instead of duplicating it", async () => {
  const res = await api("POST", `/recipes/${recipeId}/rating`, {
    token: tokenA,
    body: { stars: 2 },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.rating.ratingCount, 1);
  assert.equal(data.rating.averageRating, 2);
});

test("recipe detail returns the viewer's own rating", async () => {
  const res = await api("GET", `/recipes/${recipeId}`, { token: tokenA });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.recipe.userRating, 2);
  assert.equal(data.recipe.ratingCount, 1);
});

test("rating a nonexistent recipe returns 404", async () => {
  const res = await api("POST", `/recipes/999999/rating`, {
    token: tokenA,
    body: { stars: 3 },
  });
  assert.equal(res.status, 404);
});
