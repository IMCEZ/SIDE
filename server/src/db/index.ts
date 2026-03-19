import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'side.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(dbPath);

export const db = drizzle(sqlite);

export function initializeSchema() {
  sqlite
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `
    )
    .run();

  sqlite
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        file_path TEXT,
        data TEXT,
        avatar_path TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );
    `
    )
    .run();

  sqlite
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER,
        title TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );
    `
    )
    .run();

  sqlite
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `
    )
    .run();

  sqlite
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS world_books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        data TEXT,
        created_at INTEGER
      );
    `
    )
    .run();

  sqlite
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS presets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        data TEXT,
        is_default INTEGER,
        created_at INTEGER
      );
    `
    )
    .run();

  sqlite
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS api_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        provider TEXT,
        endpoint TEXT,
        api_key TEXT,
        model TEXT,
        is_active INTEGER,
        created_at INTEGER
      );
    `
    )
    .run();

  sqlite
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `
    )
    .run();
}

