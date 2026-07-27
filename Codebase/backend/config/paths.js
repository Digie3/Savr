import path from "path";

export const DATABASE_ROOT = path.resolve(process.cwd(), "../../Database");
export const UPLOADS_DIR = path.join(DATABASE_ROOT, "uploads");
export const LAKEHOUSE_DIR = path.join(DATABASE_ROOT, "lakehouse");