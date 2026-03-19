import { Router } from 'express';
import { db } from '../db';
import { settings } from '../db/schema';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { eq } from 'drizzle-orm';

const router = Router();

router.use(authMiddleware);

router.get('/', async (_req: AuthRequest, res) => {
  const rows = await db.select().from(settings);
  const data: Record<string, string | null> = {};
  for (const row of rows) {
    data[row.key] = row.value;
  }
  return res.json(data);
});

router.get('/:key', async (req: AuthRequest, res) => {
  const key = req.params.key;
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (!rows[0]) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.json({ key: rows[0].key, value: rows[0].value });
});

router.put('/', async (req: AuthRequest, res) => {
  const body = req.body as { key: string; value: string }[];
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const now = Date.now();
  for (const item of body) {
    if (!item.key) continue;
    await db
      .insert(settings)
      .values({ key: item.key, value: item.value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: item.value }
      });
  }

  return res.json({ updatedAt: now });
});

export default router;

