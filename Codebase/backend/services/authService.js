import bcrypt from "bcryptjs";

export async function registerUser(db, username, password) {
    const hashed = await bcrypt.hash(password, 10);

    await db.runAsync(
        `INSERT INTO Users (username, password, account_creation) VALUES (?, ?, datetime('now'))`,
        [username, hashed]
    );

    return { username };
}

export async function loginUser(db, username, password) {
    const user = await db.getAsync(`SELECT idUsers, username, password FROM Users WHERE username = ?`, [username]);

    if (!user) {
        return null;
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
        return null;
    }

    return user;
}

export async function getCurrentUser(db, id) {
    return await db.getAsync(
        `SELECT idUsers, username FROM Users WHERE idUsers = ?`,
        [id]
    );
}