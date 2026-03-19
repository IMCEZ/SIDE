import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { and, eq, like } from 'drizzle-orm';
import { db } from '../db';
import { characters } from '../db/schema';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { parseCharacterFromJSON, parseCharacterFromPNG } from '../utils/characterParser';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const charactersDir = path.resolve(process.cwd(), 'server', 'data', 'characters');

function ensureCharactersDir() {
  if (!fs.existsSync(charactersDir)) {
    fs.mkdirSync(charactersDir, { recursive: true });
  }
}

router.use(authMiddleware);

router.post('/import', upload.single('file'), async (req: AuthRequest, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'File is required' });
  }

  const ext = path.extname(file.originalname).toLowerCase();

  try {
    let parsed;
    if (ext === '.png' || file.mimetype === 'image/png') {
      parsed = parseCharacterFromPNG(file.buffer);
    } else if (ext === '.json' || file.mimetype === 'application/json') {
      parsed = parseCharacterFromJSON(file.buffer.toString('utf8'));
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    const now = Date.now();

    const insertRes = await db.insert(characters).values({
      name: parsed.name,
      filePath: null,
      data: JSON.stringify(parsed),
      avatarPath: null,
      createdAt: now,
      updatedAt: now
    });

    const rowIdRaw =
      (insertRes as unknown as { lastInsertRowid?: number | bigint }).lastInsertRowid ??
      (insertRes as unknown as { lastInsertRowid: number | bigint }).lastInsertRowid;
    const id = typeof rowIdRaw === 'bigint' ? Number(rowIdRaw) : Number(rowIdRaw);

    let avatarPath: string | null = null;

    if (ext === '.png' || file.mimetype === 'image/png') {
      ensureCharactersDir();
      const filename = `${id}.png`;
      const fullPath = path.join(charactersDir, filename);
      fs.writeFileSync(fullPath, file.buffer);
      avatarPath = `/api/v1/characters/${id}/avatar`;

      await db
        .update(characters)
        .set({ avatarPath, filePath: fullPath })
        .where(eq(characters.id, id));
    }

    const created = await db
      .select()
      .from(characters)
      .where(eq(characters.id, id))
      .limit(1);

    return res.status(201).json(created[0]);
  } catch (e: any) {
    return res.status(400).json({ error: e?.message ?? 'Failed to import character' });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  const search = (req.query.search as string | undefined)?.trim();

  let rows;
  if (search && search.length > 0) {
    rows = await db
      .select({
        id: characters.id,
        name: characters.name,
        avatarPath: characters.avatarPath,
        createdAt: characters.createdAt
      })
      .from(characters)
      .where(like(characters.name, `%${search}%`));
  } else {
    rows = await db
      .select({
        id: characters.id,
        name: characters.name,
        avatarPath: characters.avatarPath,
        createdAt: characters.createdAt
      })
      .from(characters);
  }

  return res.json(rows);
});

router.get('/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const rows = await db.select().from(characters).where(eq(characters.id, id)).limit(1);
  const row = rows[0];
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

  return res.json({ ...row, data });
});

router.delete('/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const rows = await db.select().from(characters).where(eq(characters.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }

  await db.delete(characters).where(eq(characters.id, id));

  if (row.avatarPath && row.filePath && fs.existsSync(row.filePath)) {
    try {
      fs.unlinkSync(row.filePath);
    } catch {
      // ignore
    }
  }

  return res.status(204).send();
});

router.get('/:id/avatar', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const rows = await db
    .select({
      id: characters.id,
      name: characters.name,
      avatarPath: characters.avatarPath,
      filePath: characters.filePath
    })
    .from(characters)
    .where(eq(characters.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (row.filePath && fs.existsSync(row.filePath)) {
    return res.sendFile(path.resolve(row.filePath));
  }

  const initial = row.name?.trim()?.[0]?.toUpperCase() || 'C';
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

export default router;

