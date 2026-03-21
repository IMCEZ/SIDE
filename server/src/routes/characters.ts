import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { getDb, saveDb } from '../db';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { parseCharacterFromJSON, parseCharacterFromPNG } from '../utils/characterParser';
import { importCharacterCardJSON } from '../modules/imports/service';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const charactersDir = path.resolve(process.cwd(), 'data', 'characters');

function ensureCharactersDir() {
  if (!fs.existsSync(charactersDir)) {
    fs.mkdirSync(charactersDir, { recursive: true });
  }
}

router.get('/:id/avatar', async (req: Request, res: Response) => {
  const token = req.query.token as string | undefined;

  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const database = await getDb();
  const stmt = database.prepare('SELECT id, name, avatar_path, file_path FROM characters WHERE id = ? LIMIT 1');
  stmt.bind([id]);

  let row: any = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();

  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }

  const filePath = row.file_path == null ? null : String(row.file_path);
  const name = row.name == null ? '' : String(row.name);

  if (filePath && fs.existsSync(filePath)) {
    return res.sendFile(path.resolve(filePath));
  }

  const initial = name.trim()?.[0]?.toUpperCase() || 'C';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c6af7" />
      <stop offset="1" stop-color="#22d3ee" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="256" height="256" rx="40" fill="#0f172a" />
  <circle cx="128" cy="96" r="64" fill="url(#g)" />
  <text x="128" y="116" text-anchor="middle" font-size="72" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fill="#e5e7eb">
    ${initial}
  </text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  return res.send(svg);
});

router.use(authMiddleware);

router.post('/import', upload.single('file'), async (req: AuthRequest, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'File is required' });
  }

  const ext = path.extname(file.originalname).toLowerCase();

  try {
    // JSON：走本步实现的 Character Card 导入器（不做 PNG 解析）
    if (ext === '.json' || file.mimetype === 'application/json') {
      let payload: unknown;
      try {
        payload = JSON.parse(file.buffer.toString('utf8'));
      } catch {
        return res.status(400).json({ error: 'Invalid JSON format' });
      }

      const result = await importCharacterCardJSON({
        stPayload: payload,
        userId: req.user?.userId,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error, warnings: result.warnings });
      }

      const database = await getDb();
      const selectStmt = database.prepare(
        'SELECT id, name, file_path, data, avatar_path, created_at, updated_at FROM characters WHERE id = ? LIMIT 1'
      );
      selectStmt.bind([result.characterId]);

      let row: any = null;
      if (selectStmt.step()) row = selectStmt.getAsObject();
      selectStmt.free();

      return res.status(201).json({
        id: row.id,
        name: row.name,
        filePath: row.file_path,
        data: row.data,
        avatarPath: row.avatar_path,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        warnings: result.warnings,
      });
    }

    // PNG：保留旧逻辑（本步不新增 PNG 解析）
    let parsed;
    if (ext === '.png' || file.mimetype === 'image/png') {
      parsed = parseCharacterFromPNG(file.buffer);
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    const database = await getDb();
    const now = Date.now();

    // 先插入一行（不存 avatar/file_path，之后如果是 png 再补齐）
    const insertStmt = database.prepare(
      'INSERT INTO characters (name, file_path, data, avatar_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertStmt.run([parsed.name, null, JSON.stringify(parsed), null, now, now]);
    insertStmt.free();

    const idRes = database.exec('SELECT last_insert_rowid() AS id');
    const id = Number(idRes?.[0]?.values?.[0]?.[0]);

    let avatarPath: string | null = null;
    let filePath: string | null = null;

    if (ext === '.png' || file.mimetype === 'image/png') {
      ensureCharactersDir();
      const filename = `${id}.png`;
      const fullPath = path.join(charactersDir, filename);
      fs.writeFileSync(fullPath, file.buffer);

      filePath = fullPath;
      avatarPath = `/api/v1/characters/${id}/avatar`;

      const updateStmt = database.prepare('UPDATE characters SET avatar_path = ?, file_path = ? WHERE id = ?');
      updateStmt.run([avatarPath, filePath, id]);
      updateStmt.free();
    }

    const selectStmt = database.prepare(
      'SELECT id, name, file_path, data, avatar_path, created_at, updated_at FROM characters WHERE id = ? LIMIT 1'
    );
    selectStmt.bind([id]);
    let row: any = null;
    if (selectStmt.step()) row = selectStmt.getAsObject();
    selectStmt.free();

    saveDb();

    return res.status(201).json({
      id: row.id,
      name: row.name,
      filePath: row.file_path,
      data: row.data,
      avatarPath: row.avatar_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message ?? 'Failed to import character' });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  const search = (req.query.search as string | undefined)?.trim();

  const database = await getDb();

  let rows: Array<{ id: number; name: string; avatarPath: string | null; createdAt: number | null }> = [];

  if (search && search.length > 0) {
    const pattern = `%${search}%`;
    const stmt = database.prepare('SELECT id, name, avatar_path, created_at FROM characters WHERE name LIKE ?');
    stmt.bind([pattern]);
    while (stmt.step()) {
      const obj = stmt.getAsObject() as Record<string, unknown>;
      rows.push({
        id: Number(obj.id),
        name: String(obj.name),
        avatarPath: obj.avatar_path == null ? null : String(obj.avatar_path),
        createdAt: obj.created_at == null ? null : Number(obj.created_at)
      });
    }
    stmt.free();
  } else {
    const stmt = database.prepare('SELECT id, name, avatar_path, created_at FROM characters');
    while (stmt.step()) {
      const obj = stmt.getAsObject() as Record<string, unknown>;
      rows.push({
        id: Number(obj.id),
        name: String(obj.name),
        avatarPath: obj.avatar_path == null ? null : String(obj.avatar_path),
        createdAt: obj.created_at == null ? null : Number(obj.created_at)
      });
    }
    stmt.free();
  }

  return res.json(rows);
});

router.get('/:id/export', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const format = String(req.query.format || 'json').toLowerCase();
  if (format !== 'json') {
    return res.status(400).json({ error: 'Only json export is supported' });
  }

  const database = await getDb();
  const stmt = database.prepare('SELECT id, name, data FROM characters WHERE id = ? LIMIT 1');
  stmt.bind([id]);

  let row: Record<string, unknown> | null = null;
  if (stmt.step()) {
    row = stmt.getAsObject() as Record<string, unknown>;
  }
  stmt.free();

  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = row.data ? (JSON.parse(String(row.data)) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }

  const name = String(row.name || 'character');
  const exportBody = { name, ...parsed };
  const json = JSON.stringify(exportBody, null, 2);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}.json"`);
  return res.status(200).send(Buffer.from(json, 'utf8'));
});

router.get('/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const database = await getDb();
  const stmt = database.prepare(
    'SELECT id, name, file_path, data, avatar_path, created_at, updated_at FROM characters WHERE id = ? LIMIT 1'
  );
  stmt.bind([id]);

  let row: any = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();

  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }

  let data: unknown = null;
  if (row.data) {
    try {
      data = JSON.parse(row.data);
    } catch {
      data = null;
    }
  }

  return res.json({
    id: Number(row.id),
    name: String(row.name),
    filePath: row.file_path == null ? null : String(row.file_path),
    data: data,
    avatarPath: row.avatar_path == null ? null : String(row.avatar_path),
    createdAt: row.created_at == null ? null : Number(row.created_at),
    updatedAt: row.updated_at == null ? null : Number(row.updated_at)
  });
});

router.delete('/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const database = await getDb();

  const selectStmt = database.prepare(
    'SELECT id, file_path, avatar_path FROM characters WHERE id = ? LIMIT 1'
  );
  selectStmt.bind([id]);

  let row: any = null;
  if (selectStmt.step()) row = selectStmt.getAsObject();
  selectStmt.free();

  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }

  const delStmt = database.prepare('DELETE FROM characters WHERE id = ?');
  delStmt.run([id]);
  delStmt.free();

  const filePath = row.file_path == null ? null : String(row.file_path);
  if (row.avatar_path && filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }

  saveDb();
  return res.status(204).send();
});

export default router;

