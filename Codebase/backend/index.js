import "dotenv/config";
import express from "express";
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
