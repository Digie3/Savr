import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, "..", "..", "Database", "relational_database", "v.3.0", "recipe_social_media.db");

let db;

export async function initDB() {
  sqlite3.verbose();
  db = new sqlite3.Database(dbPath);

  // Promisify run/get/all
  db.runAsync = promisify(db.run.bind(db));
  db.getAsync = promisify(db.get.bind(db));
  db.allAsync = promisify(db.all.bind(db));
  
  return db;
}

export function getDB() {
  if (!db) throw new Error("Database not initialized");
  return db;
}
