// Integration tests for the Create Recipe route.

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

const PORT = 4602;
const BASE = `http://localhost:${PORT}`;
const stamp = Date.now();

const CREATOR = {
  username: `recipe_creator_${stamp}`,
  password: "password123",
};

let tempDb;
let server;
let creatorToken;
let creatorId;

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
  const creatorPassword = bcrypt.hashSync(CREATOR.password, 10);

  const creatorResult = await run(
    db,
    `
    INSERT INTO Users (username, password, account_creation)
    VALUES (?, ?, datetime('now'))
    `,
    [CREATOR.username, creatorPassword]
  );

  creatorId = creatorResult.lastID;

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
        JWT_SECRET: "create-recipe-test-secret",
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

function buildRecipeForm(overrides = {}) {
  const form = new FormData();
  const values = {
    title: "Create Recipe Test",
    description: "Recipe created by the integration test",
    prep_time: "12",
    cooking_time: "18",
    num_servings: "3",
    ingredientName: "tomato",
    ingredientQuantity: "2",
    ingredientUnit: "pcs",
    stepText: "Slice the tomatoes and cook them.",
    ...overrides,
  };

  form.append("title", values.title);
  form.append("description", values.description);
  form.append("prep_time", values.prep_time);
  form.append("cooking_time", values.cooking_time);
  form.append("num_servings", values.num_servings);

  if (!values.omitIngredient) {
    form.append("ingredients[0][name]", values.ingredientName);
    form.append("ingredients[0][quantity]", values.ingredientQuantity);
    form.append("ingredients[0][unit]", values.ingredientUnit);
  }

  form.append("step_text_0", values.stepText);

  return form;
}

async function postRecipe(form) {
  return fetch(`${BASE}/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creatorToken}`,
    },
    body: form,
  });
}

before(async () => {
  tempDb = path.join(os.tmpdir(), `savr-create-recipe-test-${stamp}.db`);

  fs.copyFileSync(sourceDb, tempDb);
  await seedDatabase(tempDb);
  await startServer();
  await waitForHealth();

  creatorToken = await login(CREATOR);
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

test("authenticated user can create a recipe with ingredients and steps", async () => {
  const createResponse = await postRecipe(buildRecipeForm());

  assert.equal(createResponse.status, 201);

  const createData = await createResponse.json();
  assert.equal(createData.message, "Posted Recipe successfully");
  assert.ok(createData.recipeId);

  const detailResponse = await api("GET", `/recipes/${createData.recipeId}`, {
    token: creatorToken,
  });

  assert.equal(detailResponse.status, 200);

  const detailData = await detailResponse.json();

  assert.equal(detailData.recipe.id, createData.recipeId);
  assert.equal(detailData.recipe.creatorId, creatorId);
  assert.equal(detailData.recipe.creatorName, CREATOR.username);
  assert.equal(detailData.recipe.title, "Create Recipe Test");
  assert.equal(detailData.recipe.description, "Recipe created by the integration test");
  assert.equal(detailData.recipe.prepTime, 12);
  assert.equal(detailData.recipe.cookingTime, 18);
  assert.equal(detailData.recipe.numServings, 3);

  assert.equal(detailData.ingredients.length, 1);
  assert.equal(detailData.ingredients[0].name, "tomato");
  assert.equal(detailData.ingredients[0].quantity, 2);
  assert.equal(detailData.ingredients[0].unit, "pcs");

  assert.equal(detailData.steps.length, 1);
  assert.equal(detailData.steps[0].stepNumber, 1);
  assert.equal(
    detailData.steps[0].instructionText,
    "Slice the tomatoes and cook them."
  );
});

test("recipe creation rejects a submission without ingredients", async () => {
  const response = await postRecipe(
    buildRecipeForm({
      title: "Invalid Recipe Without Ingredients",
      omitIngredient: true,
    })
  );

  assert.equal(response.status, 400);

  const data = await response.json();

  assert.ok(Array.isArray(data.errors));
  assert.ok(data.errors.includes("At least one ingredient is required"));
});
