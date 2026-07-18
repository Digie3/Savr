import { getDB } from "../db.js";
import { signToken } from "../auth.js";
import { logActivity } from "../lakehouse.js";

import {
    registerUser,
    loginUser,
    getCurrentUser,
} from "../services/authService.js";

export async function register(req, res) {
    try {

        const db = getDB();

        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({ error: "Missing fields" });
        }

        await registerUser(db, username, password);

        await logActivity(db, {
            username,
            eventType: "register",
            entityType: "user",
            entityId: username,
            metadata: {
                route: "/register",
            },
        });

        return res.status(201).json({ username });

    } catch (err) {
        if (err && err.message && err.message.includes("UNIQUE")) {
            return res.status(409).json({ error: "User already exists" });
        }

        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
}

export async function login(req, res) {
    try {

        const db = getDB();

        const { username, password } = req.body || {};

        if (!username || !password) return res.status(400).json({ error: "Missing fields" });

        const user = await loginUser(db, username, password);

        if (!user) return res.status(401).json({ error: "Invalid credentials" });

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

}

export async function me(req, res) {
    const db = getDB();

    const user = await getCurrentUser(db, req.user.id);

    if (!user) return res.status(401).json({ error: "User no longer exists" });

    return res.json({ user: { id: user.idUsers, username: user.username } });

}

export function logout(req, res) {
    return res.json({ ok: true });
}