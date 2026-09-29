import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(__dirname, "..");
export const dataDir = path.join(rootDir, "data");
export const uploadsDir = path.join(rootDir, "uploads");
export const dbPath = path.join(dataDir, "blog.db");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA journal_mode = WAL");

const schema = fs.readFileSync(path.join(rootDir, "schema.sql"), "utf8");
db.exec(schema);
const commentCols = db.prepare("PRAGMA table_info(comments)").all();
if (!commentCols.some((col) => col.name === "is_admin")) {
	db.exec("ALTER TABLE comments ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
}

export function withTransaction(fn) {
	db.exec("BEGIN");
	try {
		const result = fn();
		db.exec("COMMIT");
		return result;
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	}
}
