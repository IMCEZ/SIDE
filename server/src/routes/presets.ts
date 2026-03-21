import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { getDb, saveDb } from '../db';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { autoConvertPreset } from '../utils/presetConverter';

interface PromptBlock {
  identifier: string;
  name: string;
  content: string;
  enabled: boolean;
  system: boolean;
  order: number;
}

interface PresetData {
  params: {
    temperature: number;
    maxTokens: number;
    topP: number;
    topK: number;
    frequencyPenalty: number;
    presencePenalty: number;
    repetitionPenalty: number;
    seed: number;
  };
  promptOrder: PromptBlock[];
}

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const presetsDir = path.resolve(process.cwd(), 'data', 'presets');

function ensurePresetsDir() {
  if (!fs.existsSync(presetsDir)) {
    fs.mkdirSync(presetsDir, { recursive: true });
  }
}

router.use(authMiddleware);

// 获取所有预设
router.get('/', async (_req: AuthRequest, res) => {
  try {
    const database = await getDb();
    const stmt = database.prepare('SELECT id, name, is_default, created_at, data FROM presets ORDER BY created_at DESC');

    const rows: Array<{ id: number; name: string; is_default: number; created_at: number; data: string }> = [];
    while (stmt.step()) {
      const obj = stmt.getAsObject() as Record<string, unknown>;
      rows.push({
        id: Number(obj.id),
        name: String(obj.name || '未命名预设'),
        is_default: Number(obj.is_default || 0),
        created_at: Number(obj.created_at),
        data: String(obj.data || '{}')
      });
    }
    stmt.free();

    const presets = rows.map(row => ({
      id: row.id,
      name: row.name,
      is_default: row.is_default,
      created_at: row.created_at,
      data: JSON.parse(row.data)
    }));

    return res.json(presets);
  } catch (e: any) {
    console.error('获取预设失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to fetch presets' });
  }
});

// 获取默认预设
router.get('/default', async (_req: AuthRequest, res) => {
  try {
    const database = await getDb();
    const stmt = database.prepare('SELECT id, name, data FROM presets WHERE is_default = 1 LIMIT 1');

    let row: any = null;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();

    if (!row) {
      return res.status(404).json({ error: 'No default preset' });
    }

    return res.json({
      id: row.id,
      name: row.name,
      data: row.data ? JSON.parse(row.data) : {}
    });
  } catch (e: any) {
    console.error('获取默认预设失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to fetch default preset' });
  }
});

// 导出 JSON（与客户端 presetsApi.export 对齐）
router.get('/:id/export', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const database = await getDb();
    const stmt = database.prepare('SELECT id, name, data FROM presets WHERE id = ? LIMIT 1');
    stmt.bind([id]);

    let row: Record<string, unknown> | null = null;
    if (stmt.step()) {
      row = stmt.getAsObject() as Record<string, unknown>;
    }
    stmt.free();

    if (!row) {
      return res.status(404).json({ error: 'Not found' });
    }

    const name = String(row.name || 'preset');
    let parsed: Record<string, unknown> = {};
    try {
      parsed = row.data ? (JSON.parse(String(row.data)) as Record<string, unknown>) : {};
    } catch {
      parsed = {};
    }

    const exportBody = { name, ...parsed };
    const json = JSON.stringify(exportBody, null, 2);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}.json"`);
    return res.status(200).send(Buffer.from(json, 'utf8'));
  } catch (e: any) {
    console.error('导出预设失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to export preset' });
  }
});

// 获取单个预设
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const database = await getDb();
    const stmt = database.prepare('SELECT id, name, data, is_default, created_at FROM presets WHERE id = ? LIMIT 1');
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
      is_default: row.is_default,
      created_at: row.created_at
    });
  } catch (e: any) {
    console.error('获取预设详情失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to fetch preset' });
  }
});

// 导入预设
router.post('/import', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const content = file.buffer.toString('utf8');
    let data;
    try {
      data = JSON.parse(content);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON format' });
    }

    const name = data.name || path.basename(file.originalname, '.json') || '未命名预设';
    const presetData = autoConvertPreset(data);

    const database = await getDb();
    const now = Date.now();

    const insertStmt = database.prepare(
      'INSERT INTO presets (name, data, is_default, created_at) VALUES (?, ?, ?, ?)'
    );
    insertStmt.run([name, JSON.stringify(presetData), 0, now]);
    insertStmt.free();

    const idRes = database.exec('SELECT last_insert_rowid() AS id');
    const id = Number(idRes?.[0]?.values?.[0]?.[0]);

    saveDb();

    return res.status(201).json({
      id,
      name,
      is_default: 0,
      created_at: now,
      data: presetData
    });
  } catch (e: any) {
    console.error('导入预设失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to import preset' });
  }
});

// 创建预设
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, data, isDefault } = req.body as { name?: string; data?: any; isDefault?: boolean };

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required and must be a string' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    const database = await getDb();
    const now = Date.now();

    if (isDefault) {
      const clearStmt = database.prepare('UPDATE presets SET is_default = 0 WHERE is_default = 1');
      clearStmt.run();
      clearStmt.free();
    }

    const defaultPromptOrder: PromptBlock[] = [
      { identifier: 'main_prompt', name: '主提示词', content: '你是一个有帮助的AI助手。', enabled: true, system: true, order: 0 },
      { identifier: 'world_info_before', name: '世界书（前）', content: '', enabled: true, system: false, order: 1 },
      { identifier: 'char_desc', name: '角色描述', content: '', enabled: true, system: false, order: 2 },
      { identifier: 'char_personality', name: '角色性格', content: '', enabled: true, system: false, order: 3 },
      { identifier: 'world_info_after', name: '世界书（后）', content: '', enabled: true, system: false, order: 4 },
      { identifier: 'chat_history', name: '对话历史', content: '', enabled: true, system: false, order: 5 },
      { identifier: 'user_input', name: '用户输入', content: '', enabled: true, system: false, order: 6 },
    ]

    const presetData: PresetData = data && data.params ? data : {
      params: {
        temperature: 0.7,
        maxTokens: 2048,
        topP: 0.9,
        topK: 0,
        frequencyPenalty: 0,
        presencePenalty: 0,
        repetitionPenalty: 1,
        seed: -1,
      },
      promptOrder: data?.promptOrder ?? defaultPromptOrder
    }

    const insertStmt = database.prepare(
      'INSERT INTO presets (name, data, is_default, created_at) VALUES (?, ?, ?, ?)'
    );
    insertStmt.run([trimmedName, JSON.stringify(presetData), isDefault ? 1 : 0, now]);
    insertStmt.free();

    const idRes = database.exec('SELECT last_insert_rowid() AS id');
    const id = Number(idRes?.[0]?.values?.[0]?.[0]);

    saveDb();

    console.log('预设创建成功:', { id, name: trimmedName, data: presetData });

    return res.status(201).json({
      id,
      name: trimmedName,
      is_default: isDefault ? 1 : 0,
      created_at: now,
      data: presetData
    });
  } catch (e: any) {
    console.error('创建预设失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to create preset' });
  }
});

// 更新预设
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const { name, data, isDefault } = req.body as { name?: string; data?: any; isDefault?: boolean };

    const database = await getDb();

    if (isDefault) {
      const clearStmt = database.prepare('UPDATE presets SET is_default = 0 WHERE is_default = 1');
      clearStmt.run();
      clearStmt.free();
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (data !== undefined) {
      updates.push('data = ?');
      values.push(JSON.stringify(data));
    }
    if (isDefault !== undefined) {
      updates.push('is_default = ?');
      values.push(isDefault ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const stmt = database.prepare(`UPDATE presets SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(values);
    stmt.free();

    saveDb();

    return res.json({ message: 'Updated', id });
  } catch (e: any) {
    console.error('更新预设失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to update preset' });
  }
});

// 设置默认预设
router.put('/:id/default', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const database = await getDb();

    const clearStmt = database.prepare('UPDATE presets SET is_default = 0 WHERE is_default = 1');
    clearStmt.run();
    clearStmt.free();

    const stmt = database.prepare('UPDATE presets SET is_default = 1 WHERE id = ?');
    stmt.run([id]);
    stmt.free();

    saveDb();

    return res.json({ message: 'Set as default', id });
  } catch (e: any) {
    console.error('设置默认预设失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to set default preset' });
  }
});

// 删除预设
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const database = await getDb();
    const stmt = database.prepare('DELETE FROM presets WHERE id = ?');
    stmt.run([id]);
    stmt.free();

    saveDb();

    return res.json({ message: 'Deleted', id });
  } catch (e: any) {
    console.error('删除预设失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to delete preset' });
  }
});

export default router;
