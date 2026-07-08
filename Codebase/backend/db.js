import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Defaults to the committed v3.0 database. SAVR_DB_PATH lets tests point the
// server at a throwaway copy so they never touch the real database file.
const dbPath =
  process.env.SAVR_DB_PATH ||
  path.resolve(__dirname, "..", "..", "Database", "relational_database", "v.3.0", "recipe_social_media.db");

let db;

export async function initDB() {
  sqlite3.verbose();
  db = new sqlite3.Database(dbPath);

  // Promisify run/get/all
  db.runAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes,
          });
        }
      });
    });
  };
  db.getAsync = promisify(db.get.bind(db));
  db.allAsync = promisify(db.all.bind(db));
  
  return db;
}

export function getDB() {
  if (!db) throw new Error("Database not initialized");
  return db;
}
