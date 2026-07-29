// Integration tests for the Authentication service:
// registration (validation, hashing, duplicates), login (credentials + token),
// and the protected /me and /logout routes.
//
// Runs the real server against a throwaway copy of the v3.0 database
// (SAVR_DB_PATH) so the committed database is never touched. Deterministic,
// no network or API keys required.

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

const PORT = 4604;
const BASE = `http://localhost:${PORT}`;
const stamp = Date.now();

// Valid password per the backend rule: >= 6 characters and one uppercase letter.
const VALID_PASSWORD = "Password123";

let tempDb;
let server;

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

// Read a user's stored password straight from the database (read-only) so we
// can prove it was hashed rather than stored in plaintext.
function readStoredPassword(username) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(tempDb, sqlite3.OPEN_READONLY);
    db.get(
      `SELECT password FROM Users WHERE username = ?`,
      [username],
      (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row ? row.password : null);
      }
    );
  });
}

async function registerAndLogin(username) {
  await api("POST", "/register", { body: { username, password: VALID_PASSWORD } });
  const res = await api("POST", "/login", { body: { username, password: VALID_PASSWORD } });
  const data = await res.json();
  return data.token;
}

before(async () => {
  tempDb = path.join(os.tmpdir(), `savr-auth-test-${stamp}.db`);
  fs.copyFileSync(sourceDb, tempDb);
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

test("registers a new user and stores the password hashed, not in plaintext", async () => {
  const username = `authuser_new_${stamp}`;

  const res = await api("POST", "/register", {
    body: { username, password: VALID_PASSWORD },
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.username, username);

  const stored = await readStoredPassword(username);
  assert.ok(stored, "user should exist in the database");
  assert.notEqual(stored, VALID_PASSWORD, "password must not be stored in plaintext");
  assert.equal(
    bcrypt.compareSync(VALID_PASSWORD, stored),
    true,
    "stored value should be a bcrypt hash of the password"
  );
});

test("rejects a duplicate username with 409", async () => {
  const username = `authuser_dup_${stamp}`;

  const first = await api("POST", "/register", {
    body: { username, password: VALID_PASSWORD },
  });
  assert.equal(first.status, 201);

  const second = await api("POST", "/register", {
    body: { username, password: VALID_PASSWORD },
  });
  assert.equal(second.status, 409);
});

test("rejects missing fields and weak passwords with 400", async () => {
  // Missing password.
  const missing = await api("POST", "/register", {
    body: { username: `authuser_missing_${stamp}` },
  });
  assert.equal(missing.status, 400);

  // No uppercase letter.
  const noUpper = await api("POST", "/register", {
    body: { username: `authuser_noupper_${stamp}`, password: "password123" },
  });
  assert.equal(noUpper.status, 400);

  // Too short.
  const tooShort = await api("POST", "/register", {
    body: { username: `authuser_short_${stamp}`, password: "Ab1" },
  });
  assert.equal(tooShort.status, 400);
});

test("login rejects bad credentials and returns a token for valid ones", async () => {
  const username = `authuser_login_${stamp}`;
  const reg = await api("POST", "/register", {
    body: { username, password: VALID_PASSWORD },
  });
  assert.equal(reg.status, 201);

  // Wrong password.
  const wrong = await api("POST", "/login", {
    body: { username, password: "WrongPass123" },
  });
  assert.equal(wrong.status, 401);

  // Unknown user.
  const unknown = await api("POST", "/login", {
    body: { username: `nobody_${stamp}`, password: VALID_PASSWORD },
  });
  assert.equal(unknown.status, 401);

  // Correct credentials.
  const ok = await api("POST", "/login", {
    body: { username, password: VALID_PASSWORD },
  });
  assert.equal(ok.status, 200);
  const data = await ok.json();
  assert.equal(typeof data.token, "string");
  assert.ok(data.token.length > 0);
  assert.equal(data.user.username, username);
  assert.equal(typeof data.user.id, "number");
});

test("protected /me and /logout require a valid token", async () => {
  const username = `authuser_me_${stamp}`;
  const token = await registerAndLogin(username);

  // Valid token.
  const meOk = await api("GET", "/me", { token });
  assert.equal(meOk.status, 200);
  const meData = await meOk.json();
  assert.equal(meData.user.username, username);

  // No token.
  const meNoToken = await api("GET", "/me");
  assert.equal(meNoToken.status, 401);

  // Malformed / invalid token.
  const meBadToken = await api("GET", "/me", { token: "not-a-real-token" });
  assert.equal(meBadToken.status, 401);

  // Logout with a valid token.
  const logout = await api("POST", "/logout", { token });
  assert.equal(logout.status, 200);
  const logoutData = await logout.json();
  assert.equal(logoutData.ok, true);
});
