// Integration tests for the Image Service HTTP surface: auth, input validation,
// the mock-safe "not configured" response, and persistence of a selected
// external ingredient image URL through recipe creation.
//
// The server runs against a throwaway copy of the v3.0 database (SAVR_DB_PATH)
// with NO Google keys set, so the search endpoint reports configured:false.
//
// Run with:  npm test   (from Codebase/backend)

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

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

const PORT = 4598;
const BASE = `http://localhost:${PORT}`;
const stamp = Date.now();
const USER = { username: `imguser_${stamp}`, password: "password123" };

let tempDb;
let server;
let token;

function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, ["index.js"], {
      cwd: backendDir,
      env: {
        ...process.env,
        SAVR_DB_PATH: tempDb,
        PORT: String(PORT),
        JWT_SECRET: "test-secret",
        // Deliberately no GOOGLE_SEARCH_* keys -> endpoint returns configured:false.
        GOOGLE_SEARCH_API_KEY: "",
        GOOGLE_SEARCH_ENGINE_ID: "",
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
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Server did not become healthy in time");
}

function api(method, url, { token: t, body } = {}) {
  return fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function createRecipeWithIngredientUrl(ingredientImageUrl) {
  const form = new FormData();
  form.append("title", "Image Service Test");
  form.append("description", "d");
  form.append("prep_time", "5");
  form.append("cooking_time", "10");
  form.append("num_servings", "2");
  form.append("ingredients[0][name]", `Ingredient_${Date.now()}`);
  form.append("ingredients[0][quantity]", "2");
  form.append("ingredients[0][unit]", "pcs");
  form.append("ingredients[0][other_desc]", "");
  form.append("ingredients[0][imageUrl]", ingredientImageUrl);
  form.append("step_text_0", "Do the thing");

  const response = await fetch(`${BASE}/create`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await response.json();
  return data.recipeId;
}

before(async () => {
  tempDb = path.join(os.tmpdir(), `savr-image-test-${stamp}.db`);
  fs.copyFileSync(sourceDb, tempDb);
  await startServer();
  await waitForHealth();

  await api("POST", "/register", { body: USER });
  const loginRes = await api("POST", "/login", { body: USER });
  token = (await loginRes.json()).token;
});

after(async () => {
  if (server) server.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
  try {
    fs.rmSync(tempDb, { force: true });
  } catch {
    // may be locked briefly on Windows; harmless if left behind
  }
});

// --- Auth + validation ---

test("rejects an unauthenticated search", async () => {
  const res = await api("GET", "/images/search?ingredient=tomato");
  assert.equal(res.status, 401);
});

test("rejects a missing query", async () => {
  const res = await api("GET", "/images/search", { token });
  assert.equal(res.status, 400);
});

test("rejects a blank / whitespace query", async () => {
  const res = await api("GET", "/images/search?ingredient=%20%20", { token });
  assert.equal(res.status, 400);
});

test("rejects an overly long query", async () => {
  const long = "x".repeat(150);
  const res = await api("GET", `/images/search?ingredient=${long}`, { token });
  assert.equal(res.status, 400);
});

test("rejects invalid limit values", async () => {
  for (const limit of [0, 99, "abc"]) {
    const res = await api("GET", `/images/search?ingredient=tomato&limit=${limit}`, {
      token,
    });
    assert.equal(res.status, 400, `limit=${limit} should be rejected`);
  }
});

test("returns configured:false when no API keys are set", async () => {
  const res = await api("GET", "/images/search?ingredient=tomato", { token });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.configured, false);
  assert.deepEqual(data.images, []);
  assert.equal(data.provider, "google-custom-search");
  assert.ok(data.message);
});

// --- Persistence of a selected external ingredient image ---

test("stores a valid external ingredient image URL on the recipe", async () => {
  const url = "https://cdn.example.com/tomato.jpg";
  const recipeId = await createRecipeWithIngredientUrl(url);
  assert.ok(recipeId, "recipe should be created");

  const res = await api("GET", `/recipes/${recipeId}`, { token });
  const data = await res.json();
  assert.equal(data.ingredients[0].imageUrl, url);
});

test("ignores an unsafe (non-http) ingredient image URL", async () => {
  const recipeId = await createRecipeWithIngredientUrl("javascript:alert(1)");
  assert.ok(recipeId, "recipe should still be created");

  const res = await api("GET", `/recipes/${recipeId}`, { token });
  const data = await res.json();
  assert.equal(data.ingredients[0].imageUrl, null);
});
