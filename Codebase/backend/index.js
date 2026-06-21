import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import bcrypt from "bcryptjs";
import { initDB, getDB } from "./db.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

async function start() {
  await initDB();
  const db = getDB();

  app.post("/register", async (req, res) => {
    try {
      const { username, email, password } = req.body || {};
      if (!username || !email || !password) {
        return res.status(400).json({ error: "Missing fields" });
      }

      const hashed = await bcrypt.hash(password, 10);

      await db.runAsync(
        `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
        [username, email, hashed]
      );

      return res.status(201).json({ username, email });
    } catch (err) {
      if (err && err.message && err.message.includes("UNIQUE")) {
        return res.status(409).json({ error: "User already exists" });
      }
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: "Missing fields" });

      const user = await db.getAsync(`SELECT id, username, email, password FROM users WHERE email = ?`, [email]);
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ error: "Invalid credentials" });

      // minimal response — no token management
      return res.json({ id: user.id, username: user.username, email: user.email });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`Auth server listening on http://localhost:${port}`));
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
