import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { getDb, saveDb } from '../db';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { parseWorldBookFromObject } from '../utils/worldBookParser';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const worldsDir = path.resolve(process.cwd(), 'data', 'worlds');

function ensureWorldsDir() {
  if (!fs.existsSync(worldsDir)) {
    fs.mkdirSync(worldsDir, { recursive: true });
  }
}

router.use(authMiddleware);

// 获取所有世界书
router.get('/', async (_req: AuthRequest, res) => {
  const database = await getDb();
  const stmt = database.prepare('SELECT id, name, created_at FROM world_books ORDER BY created_at DESC');
  
  const rows: Array<{ id: number; name: string; created_at: number; entry_count: number }> = [];
  while (stmt.step()) {
    const obj = stmt.getAsObject() as Record<string, unknown>;
    const data = obj.data ? JSON.parse(String(obj.data)) : {};
    const entries = data.entries || [];
    rows.push({
      id: Number(obj.id),
      name: String(obj.name || '未命名世界书'),
      created_at: Number(obj.created_at),
      entry_count: Array.isArray(entries) ? entries.length : 0
    });
  }
  stmt.free();

  return res.json(rows);
});

router.get('/:id/export', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const database = await getDb();
  const stmt = database.prepare('SELECT id, name, data FROM world_books WHERE id = ? LIMIT 1');
  stmt.bind([id]);

  let row: Record<string, unknown> | null = null;
  if (stmt.step()) {
    row = stmt.getAsObject() as Record<string, unknown>;
  }
  stmt.free();

  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }

  const name = String(row.name || 'worldbook');
  let data: Record<string, unknown> = {};
  try {
    data = row.data ? (JSON.parse(String(row.data)) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  const exportBody = { name, ...data };
  const json = JSON.stringify(exportBody, null, 2);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}.json"`);
  return res.status(200).send(Buffer.from(json, 'utf8'));
});

// 获取单个世界书
router.get('/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const database = await getDb();
  const stmt = database.prepare('SELECT id, name, data, created_at FROM world_books WHERE id = ? LIMIT 1');
  stmt.bind([id]);

  let row: any = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();

  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }

  return res.json({
    id: row.id,
    name: row.name,
    data: row.data ? JSON.parse(row.data) : {},
    createdAt: row.created_at
  });
});

// 导入世界书
router.post('/import', upload.single('file'), async (req: AuthRequest, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'File is required' });
  }

  try {
    const content = file.buffer.toString('utf8');
    const data = JSON.parse(content);
    const worldBookData = parseWorldBookFromObject(data);
    
    const name = worldBookData.name || path.basename(file.originalname, '.json') || '未命名世界书';
    
    const database = await getDb();
    const now = Date.now();

    const insertStmt = database.prepare(
      'INSERT INTO world_books (name, data, created_at) VALUES (?, ?, ?)'
    );
    insertStmt.run([name, JSON.stringify(worldBookData), now]);
    insertStmt.free();

    const idRes = database.exec('SELECT last_insert_rowid() AS id');
    const id = Number(idRes?.[0]?.values?.[0]?.[0]);

    saveDb();

    return res.status(201).json({
      id,
      name,
      createdAt: now
    });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message ?? 'Failed to import world book' });
  }
});

// 创建世界书
router.post('/', async (req: AuthRequest, res) => {
  const { name, data } = req.body as { name?: string; data?: any };
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const database = await getDb();
  const now = Date.now();

  const insertStmt = database.prepare(
    'INSERT INTO world_books (name, data, created_at) VALUES (?, ?, ?)'
  );
  insertStmt.run([name, JSON.stringify(data || { entries: [] }), now]);
  insertStmt.free();

  const idRes = database.exec('SELECT last_insert_rowid() AS id');
  const id = Number(idRes?.[0]?.values?.[0]?.[0]);

  saveDb();

  return res.status(201).json({
    id,
    name,
    createdAt: now
  });
});

// 更新世界书
router.put('/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const { name, data } = req.body as { name?: string; data?: any };
  
  const database = await getDb();
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (data !== undefined) {
    updates.push('data = ?');
    values.push(JSON.stringify(data));
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(id);
  
  const stmt = database.prepare(`UPDATE world_books SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(values);
  stmt.free();
  
  saveDb();

  return res.json({ message: 'Updated' });
});

// 删除世界书
router.delete('/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const database = await getDb();
  const stmt = database.prepare('DELETE FROM world_books WHERE id = ?');
  stmt.run([id]);
  stmt.free();

  saveDb();

  return res.json({ message: 'Deleted' });
});

export default router;
