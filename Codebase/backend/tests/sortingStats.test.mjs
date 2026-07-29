// Integration tests for the Sorting & Statistics behaviour of the recipe feed
// (GET /recipes?sort=&order=). Sorting by newest/highest-rated/most-viewed and
// the view-count / average-rating aggregates are all computed in SQLite, so
// these tests seed deterministic data into a throwaway DB copy and assert the
// resulting order and counts.
//
// NOTE: the analytics *dashboard* (GET /analytics/dashboard) reads the lakehouse
// gold Delta tables via DuckDB, which requires the Spark/PySpark/Delta pipeline
// to have run. That is intentionally NOT covered here — these tests exercise the
// deterministic SQLite-backed sorting/statistics logic instead.

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

const PORT = 4605;
const BASE = `http://localhost:${PORT}`;
const stamp = Date.now();

let tempDb;
let server;
let ids; // { A, B, C } — the recipe ids we seed

// --- sqlite helpers (setup only) ---
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

// Seeds one creator, one rater, and three recipes (A, B, C) with controlled
// dates, ratings, and view-event counts so every ordering is unambiguous:
//   date  (newest->oldest): C, B, A
//   rating (high->low):     A(5), B(3), C(1)
//   views  (high->low):     B(5), C(3), A(1)
async function seedDatabase(dbPath) {
  const db = new sqlite3.Database(dbPath);
  const hash = bcrypt.hashSync("Password123", 10);

  const creator = await run(
    db,
    `INSERT INTO Users (username, password, account_creation) VALUES (?, ?, datetime('now'))`,
    [`sortcreator_${stamp}`, hash]
  );
  const rater = await run(
    db,
    `INSERT INTO Users (username, password, account_creation) VALUES (?, ?, datetime('now'))`,
    [`sortrater_${stamp}`, hash]
  );
  const creatorId = creator.lastID;
  const raterId = rater.lastID;

  async function insertRecipe(title, datePosted) {
    const r = await run(
      db,
      `INSERT INTO Recipes
         (Users_idUsers, title, description, prep_time, cooking_time, num_servings, date_posted)
       VALUES (?, ?, 'seed', 5, 10, 2, ?)`,
      [creatorId, title, datePosted]
    );
    return r.lastID;
  }

  const A = await insertRecipe(`SortA_${stamp}`, "2020-01-01 00:00:00");
  const B = await insertRecipe(`SortB_${stamp}`, "2020-02-01 00:00:00");
  const C = await insertRecipe(`SortC_${stamp}`, "2020-03-01 00:00:00");

  async function rate(recipeId, stars) {
    await run(
      db,
      `INSERT INTO Ratings (Recipes_idRecipes, Users_idUsers, num_stars, date_posted)
       VALUES (?, ?, ?, datetime('now'))`,
      [recipeId, raterId, stars]
    );
  }
  await rate(A, 5);
  await rate(B, 3);
  await rate(C, 1);

  async function addViews(recipeId, count) {
    for (let i = 0; i < count; i += 1) {
      await run(
        db,
        `INSERT INTO ActivityEvents (event_type, entity_type, entity_id, source, created_at)
         VALUES ('recipe_view', 'recipe', ?, 'web', datetime('now'))`,
        [String(recipeId)]
      );
    }
  }
  await addViews(A, 1);
  await addViews(B, 5);
  await addViews(C, 3);

  await closeDb(db);
  return { A, B, C };
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
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Server did not become healthy in time");
}

// Returns the ids of our three seeded recipes in the order the feed lists them
// (filtering out any pre-existing recipes in the copied database).
async function feedOrder(query = "") {
  const res = await fetch(`${BASE}/recipes${query}`);
  const { recipes } = await res.json();
  const mine = new Set([ids.A, ids.B, ids.C]);
  return recipes.filter((r) => mine.has(r.id)).map((r) => r.id);
}

before(async () => {
  tempDb = path.join(os.tmpdir(), `savr-sort-test-${stamp}.db`);
  fs.copyFileSync(sourceDb, tempDb);
  ids = await seedDatabase(tempDb);
  await startServer();
  await waitForHealth();
});

after(async () => {
  if (server) server.kill();
  await new Promise((r) => setTimeout(r, 300));
  try {
    fs.rmSync(tempDb, { force: true });
  } catch {
    // may be briefly locked on Windows; harmless if left behind
  }
});

test("sorts by newest first by default and oldest first with order=asc", async () => {
  assert.deepEqual(await feedOrder(""), [ids.C, ids.B, ids.A]);
  assert.deepEqual(await feedOrder("?sort=date&order=desc"), [ids.C, ids.B, ids.A]);
  assert.deepEqual(await feedOrder("?sort=date&order=asc"), [ids.A, ids.B, ids.C]);
});

test("sorts by highest average rating when sort=rating", async () => {
  assert.deepEqual(await feedOrder("?sort=rating&order=desc"), [ids.A, ids.B, ids.C]);
  assert.deepEqual(await feedOrder("?sort=rating&order=asc"), [ids.C, ids.B, ids.A]);
});

test("sorts by most viewed when sort=views", async () => {
  assert.deepEqual(await feedOrder("?sort=views&order=desc"), [ids.B, ids.C, ids.A]);
  assert.deepEqual(await feedOrder("?sort=views&order=asc"), [ids.A, ids.C, ids.B]);
});

test("aggregates view counts and average ratings correctly from seeded data", async () => {
  const res = await fetch(`${BASE}/recipes`);
  const { recipes } = await res.json();
  const byId = Object.fromEntries(recipes.map((r) => [r.id, r]));

  assert.equal(byId[ids.A].viewCount, 1);
  assert.equal(byId[ids.B].viewCount, 5);
  assert.equal(byId[ids.C].viewCount, 3);

  assert.equal(byId[ids.A].averageRating, 5);
  assert.equal(byId[ids.B].averageRating, 3);
  assert.equal(byId[ids.C].averageRating, 1);
});

test("falls back to newest ordering for an unrecognized sort value", async () => {
  assert.deepEqual(await feedOrder("?sort=not-a-real-sort"), [ids.C, ids.B, ids.A]);
});
