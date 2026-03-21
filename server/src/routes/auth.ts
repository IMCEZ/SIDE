import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb, saveDb } from '../db';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const DEFAULT_PASSWORD = '123456';

function getBearerToken(authHeader?: string) {
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

function signToken(userId: number) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

// 初始化默认用户
export async function initDefaultUser(): Promise<void> {
  const database = await getDb();
  
  const stmt = database.prepare('SELECT 1 FROM users LIMIT 1');
  const hasUser = stmt.step();
  stmt.free();

  if (!hasUser) {
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    const now = Date.now();
    
    const insertStmt = database.prepare(
      'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)'
    );
    insertStmt.run(['admin', hash, now]);
    insertStmt.free();
    saveDb();
    console.log('✅ 默认用户已创建，密码: 123456');
  }
}

router.get('/status', async (_req, res) => {
  const database = await getDb();
  const stmt = database.prepare('SELECT 1 FROM users LIMIT 1');
  let hasUser = false;
  if (stmt.step()) hasUser = true;
  stmt.free();
  return res.json({ hasUser });
});

router.post('/setup', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  const database = await getDb();

  const existingStmt = database.prepare('SELECT 1 FROM users LIMIT 1');
  const hasUser = existingStmt.step();
  existingStmt.free();

  if (hasUser) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password too short' });
  }

  const hash = await bcrypt.hash(password, 12);
  const now = Date.now();

  const insertStmt = database.prepare(
    'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)'
  );
  insertStmt.run([username, hash, now]);
  insertStmt.free();

  saveDb();

  const idRes = database.exec('SELECT last_insert_rowid() AS id');
  const id = Number(idRes[0]?.values?.[0]?.[0]);
  const token = signToken(id);

  return res.json({ token });
});

router.post('/login', async (req, res) => {
  const { password } = req.body as { password?: string };

  if (!password) {
    return res.status(400).json({ error: 'Missing password' });
  }

  const database = await getDb();
  const stmt = database.prepare('SELECT id, password_hash FROM users LIMIT 1');
  let user: { id: number; password_hash: string } | undefined;
  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    user = {
      id: Number(row.id),
      password_hash: String(row.password_hash)
    };
  }
  stmt.free();

  if (!user) {
    return res.status(403).json({ error: 'Not initialized' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user.id);

  return res.json({ token });
});

router.get('/verify', (req, res) => {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    jwt.verify(token, JWT_SECRET);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// 修改密码
router.put('/password', async (req, res) => {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let userId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    userId = decoded.userId;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword?: string };

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Missing password' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password too short' });
  }

  const database = await getDb();
  const stmt = database.prepare('SELECT password_hash FROM users WHERE id = ?');
  stmt.bind([userId]);
  
  let passwordHash: string | undefined;
  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    passwordHash = String(row.password_hash);
  }
  stmt.free();

  if (!passwordHash) {
    return res.status(404).json({ error: 'User not found' });
  }

  const ok = await bcrypt.compare(oldPassword, passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid old password' });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  const updateStmt = database.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
  updateStmt.run([newHash, userId]);
  updateStmt.free();
  saveDb();

  return res.json({ message: 'Password updated' });
});

export default router;
