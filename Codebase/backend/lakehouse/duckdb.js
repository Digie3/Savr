import duckdb from "duckdb";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const db = new duckdb.Database(":memory:");

const connection = db.connect();

const GOLD_PATH = path.join(
    __dirname,
    "data",
    "gold"
);

export async function initDuckDB() {
    connection.run(`
        INSTALL delta;
        LOAD delta;
    `);

    console.log("DuckDB initialized.");
}

export function getDuckDB() {
    return connection;
}

export { GOLD_PATH };