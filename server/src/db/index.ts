import path from 'path'
import fs from 'fs'
import initSqlJs, { Database } from 'sql.js'
import bcrypt from 'bcryptjs'

const DATA_DIR = path.resolve(process.cwd(), 'data')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

for (const dir of ['characters', 'worlds', 'presets']) {
  const p = path.join(DATA_DIR, dir)
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

const DB_PATH = path.resolve(process.cwd(), 'data', 'side.db')

let db: Database | undefined

function normalizeTimestampColumns(database: Database): void {
  const timestampColumns = [
    { table: 'users', columns: ['created_at'] },
    { table: 'characters', columns: ['created_at', 'updated_at'] },
    { table: 'conversations', columns: ['created_at', 'updated_at'] },
    { table: 'messages', columns: ['created_at'] },
    { table: 'world_books', columns: ['created_at'] },
    { table: 'presets', columns: ['created_at'] },
    { table: 'api_configs', columns: ['created_at'] },

    // ST/四资源兼容骨架表
    { table: 'worldbooks', columns: ['created_at', 'updated_at'] },
    { table: 'worldbook_entries', columns: ['created_at'] },
    { table: 'preset_prompts', columns: ['created_at'] },
    { table: 'regex_rulesets', columns: ['created_at'] },
    { table: 'api_profiles', columns: ['created_at'] },
    { table: 'chat_sessions', columns: ['created_at', 'updated_at'] },
    { table: 'chat_messages', columns: ['created_at'] },
    { table: 'import_jobs', columns: ['created_at', 'started_at', 'finished_at'] },
    { table: 'error_logs', columns: ['created_at'] },
  ]

  for (const item of timestampColumns) {
    for (const column of item.columns) {
      database.run(
        `UPDATE ${item.table} SET ${column} = ${column} * 1000 WHERE ${column} IS NOT NULL AND ${column} < 1000000000000`
      )
    }
  }
}

export async function getDb(): Promise<Database> {
  if (db) return db
  const SQL = await initSqlJs()
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }
  return db
}

export function saveDb(): void {
  if (!db) return
  const data = db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

export async function initDatabase(): Promise<void> {
  const database = await getDb()

  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_path TEXT,
      data TEXT,
      avatar_path TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER,
      title TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS world_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      data TEXT,
      created_at INTEGER
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      data TEXT,
      is_default INTEGER DEFAULT 0,
      created_at INTEGER
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS api_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      provider TEXT NOT NULL,
      endpoint TEXT,
      api_key TEXT,
      model TEXT,
      is_active INTEGER DEFAULT 0,
      created_at INTEGER
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  // ================================
  // ST/四资源兼容骨架：最小表结构（不影响现有业务表）
  // ================================

  database.run(`
    CREATE TABLE IF NOT EXISTS worldbooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      description TEXT,
      data TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS worldbook_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worldbook_id INTEGER,
      keys TEXT,
      content TEXT,
      entry_order INTEGER,
      enabled INTEGER,
      position TEXT,
      probability TEXT,
      data TEXT,
      created_at INTEGER
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS preset_prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      preset_id INTEGER,
      identifier TEXT,
      name TEXT,
      content TEXT,
      enabled INTEGER,
      system INTEGER,
      sort_order INTEGER,
      data TEXT,
      created_at INTEGER
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS regex_rulesets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      data TEXT,
      created_at INTEGER
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS api_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      provider TEXT NOT NULL,
      endpoint TEXT,
      api_key TEXT,
      model TEXT,
      is_active INTEGER,
      created_at INTEGER
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      character_id INTEGER,
      title TEXT,
      status TEXT,
      preset_id INTEGER,
      api_profile_id INTEGER,
      worldbook_ids TEXT,
      regex_ruleset_id INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_session_id INTEGER,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      content_format TEXT,
      metadata TEXT,
      status TEXT,
      created_at INTEGER
    );
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS import_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      resource_kind TEXT,
      status TEXT,
      raw_data TEXT,
      normalized_data TEXT,
      error_text TEXT,
      created_at INTEGER,
      started_at INTEGER,
      finished_at INTEGER
    );
  `)

  // 兼容已存在的旧库：补齐 chat_sessions 绑定字段
  try {
    database.run('ALTER TABLE chat_sessions ADD COLUMN preset_id INTEGER')
  } catch {
    // ignore: column may already exist
  }
  try {
    database.run('ALTER TABLE chat_sessions ADD COLUMN api_profile_id INTEGER')
  } catch {
    // ignore: column may already exist
  }
  try {
    database.run('ALTER TABLE chat_sessions ADD COLUMN worldbook_ids TEXT')
  } catch {
    // ignore: column may already exist
  }
  try {
    database.run('ALTER TABLE chat_sessions ADD COLUMN regex_ruleset_id INTEGER')
  } catch {
    // ignore: column may already exist
  }

  try {
    database.run('ALTER TABLE chat_messages ADD COLUMN content_format TEXT')
  } catch {
    // ignore
  }
  try {
    database.run('ALTER TABLE chat_messages ADD COLUMN status TEXT')
  } catch {
    // ignore
  }
  database.run(
    `UPDATE chat_messages SET content_format = 'text/plain' WHERE content_format IS NULL OR TRIM(COALESCE(content_format,'')) = ''`
  )
  database.run(`UPDATE chat_messages SET status = 'done' WHERE status IS NULL OR TRIM(COALESCE(status,'')) = ''`)

  // 兼容已存在的旧库：如果 import_jobs 表之前没有 raw_data 列，则补齐
  try {
    database.run('ALTER TABLE import_jobs ADD COLUMN raw_data TEXT')
  } catch {
    // ignore: column may already exist
  }

  // 兼容旧库：曾用保留字 order 作为列名（需引号）；现统一为 entry_order / sort_order
  try {
    database.run('ALTER TABLE worldbook_entries RENAME COLUMN "order" TO entry_order')
  } catch {
    // ignore: 新库或已迁移
  }
  try {
    database.run('ALTER TABLE preset_prompts RENAME COLUMN "order" TO sort_order')
  } catch {
    // ignore: 新库或已迁移
  }

  database.run(`
    CREATE TABLE IF NOT EXISTS error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      job_id INTEGER,
      code TEXT,
      message TEXT,
      details TEXT,
      created_at INTEGER
    );
  `)

  const userResult = database.exec('SELECT COUNT(*) as count FROM users')
  const userCount = userResult.length > 0 ? userResult[0].values[0][0] : 0

  if (userCount === 0) {
    const passwordHash = bcrypt.hashSync('123456', 10)
    database.run(
      'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
      ['admin', passwordHash, Date.now()]
    )
  }

  normalizeTimestampColumns(database)

  saveDb()
  console.log('✅ 数据库初始化完成')
}