import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../db/schema';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

function getBearerToken(authHeader?: string) {
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

function signToken(userId: number) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

router.get('/status', async (_req, res) => {
  const existing = await db.select().from(users).limit(1);
  const hasUser = existing.length > 0;
  return res.json({ hasUser });
});

router.post('/setup', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) {
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

  const insertRes = await db.insert(users).values({
    username,
    passwordHash: hash,
    createdAt: now
  });

  const userId =
    (insertRes as unknown as { lastInsertRowid?: number | bigint }).lastInsertRowid ??
    (insertRes as unknown as { lastInsertRowid: number | bigint }).lastInsertRowid;

  const idNum = typeof userId === 'bigint' ? Number(userId) : Number(userId);
  const token = signToken(idNum);

  return res.json({ token });
});

router.post('/login', async (req, res) => {
  const { password } = req.body as { password?: string };

  if (!password) {
    return res.status(400).json({ error: 'Missing password' });
  }

  const rows = await db.select().from(users).limit(1);
  const user = rows[0];

  if (!user) {
    return res.status(403).json({ error: 'Not initialized' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
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

export default router;

