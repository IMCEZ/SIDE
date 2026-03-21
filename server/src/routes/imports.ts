import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { getDb } from '../db';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { AppError } from '../core/errors/AppError';
import { errorCodes } from '../core/errors/errorCodes';
import { importCharacterCardJSON, importPromptPresetJSON, importRegexRulesJSON, importWorldbookV1JSON } from '../modules/imports/service';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authMiddleware);

router.post('/character', upload.single('file'), async (req: AuthRequest, res) => {
  const file = req.file;
  if (!file) {
    throw new AppError({ status: 400, message: 'File is required', code: errorCodes.VALIDATION_ERROR });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.png' || file.mimetype === 'image/png') {
    throw new AppError({
      status: 400,
      message: 'PNG character card import is not supported in this step',
      code: errorCodes.IMPORT_NOT_IMPLEMENTED,
    });
  }

  if (ext !== '.json' && file.mimetype !== 'application/json' && file.mimetype !== 'text/plain') {
    throw new AppError({ status: 400, message: 'Unsupported file type', code: errorCodes.VALIDATION_ERROR });
  }

  let payload: unknown;
  try {
    const text = file.buffer.toString('utf8');
    payload = JSON.parse(text);
  } catch (e: any) {
    throw new AppError({
      status: 400,
      message: 'Invalid JSON format',
      code: errorCodes.ST_VALIDATION_FAILED,
      cause: e,
    });
  }

  const userId = req.user?.userId;
  const result = await importCharacterCardJSON({ stPayload: payload, userId });

  if (!result.success) {
    throw new AppError({
      status: 400,
      message: result.error,
      code: result.code,
      data: { jobId: result.jobId },
    });
  }

  return res.status(201).json({
    success: true,
    jobId: result.jobId,
    id: result.characterId,
    characterId: result.characterId,
    warnings: result.warnings,
  });
});

// 导入世界书（world_book_v1 JSON）
router.post('/worldbook', upload.single('file'), async (req: AuthRequest, res) => {
  const file = req.file;
  if (!file) {
    throw new AppError({ status: 400, message: 'File is required', code: errorCodes.VALIDATION_ERROR });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.png' || file.mimetype === 'image/png') {
    throw new AppError({
      status: 400,
      message: 'PNG worldbook import is not supported in this step',
      code: errorCodes.IMPORT_NOT_IMPLEMENTED,
    });
  }

  if (ext !== '.json' && file.mimetype !== 'application/json' && file.mimetype !== 'text/plain') {
    throw new AppError({ status: 400, message: 'Unsupported file type', code: errorCodes.VALIDATION_ERROR });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(file.buffer.toString('utf8'));
  } catch (e: any) {
    throw new AppError({
      status: 400,
      message: 'Invalid JSON format',
      code: errorCodes.ST_VALIDATION_FAILED,
      cause: e,
    });
  }

  const userId = req.user?.userId;
  const result = await importWorldbookV1JSON({ stPayload: payload, userId });

  if (!result.success) {
    throw new AppError({
      status: 400,
      message: result.error,
      code: result.code,
      data: { jobId: result.jobId },
    });
  }

  return res.status(201).json({
    success: true,
    jobId: result.jobId,
    id: result.worldbookId,
    worldbookId: result.worldbookId,
    warnings: result.warnings,
  });
});

// 最小列表接口：列出已导入的 worldbooks
router.get('/worldbook', async (_req: AuthRequest, res) => {
  const database = await getDb();
  const stmt = database.prepare(
    'SELECT id, name, description, data, created_at, updated_at FROM worldbooks ORDER BY updated_at DESC'
  );

  const rows: Array<{ id: number; name: string; description: string | null; created_at: number | null; updated_at: number | null; entry_count: number }> = [];
  while (stmt.step()) {
    const obj = stmt.getAsObject() as Record<string, unknown>;
    const id = Number(obj.id);
    const countStmt = database.prepare('SELECT COUNT(*) as count FROM worldbook_entries WHERE worldbook_id = ?');
    countStmt.bind([id]);
    let count = 0;
    if (countStmt.step()) {
      const cObj = countStmt.getAsObject() as Record<string, unknown>;
      count = Number(cObj.count ?? 0);
    }
    countStmt.free();

    rows.push({
      id,
      name: String(obj.name || '未命名世界书'),
      description: obj.description == null ? null : String(obj.description),
      created_at: obj.created_at == null ? null : Number(obj.created_at),
      updated_at: obj.updated_at == null ? null : Number(obj.updated_at),
      entry_count: count,
    });
  }
  stmt.free();

  return res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      entryCount: r.entry_count,
    }))
  );
});

// 导入 Prompt Preset（ST Prompt Preset）
router.post('/preset', upload.single('file'), async (req: AuthRequest, res) => {
  const file = req.file;
  if (!file) {
    throw new AppError({ status: 400, message: 'File is required', code: errorCodes.VALIDATION_ERROR });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.json' && file.mimetype !== 'application/json' && file.mimetype !== 'text/plain') {
    throw new AppError({ status: 400, message: 'Unsupported file type', code: errorCodes.VALIDATION_ERROR });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(file.buffer.toString('utf8'));
  } catch (e: any) {
    throw new AppError({
      status: 400,
      message: 'Invalid JSON format',
      code: errorCodes.ST_VALIDATION_FAILED,
      cause: e,
    });
  }

  const userId = req.user?.userId;
  const name = (typeof (payload as any)?.name === 'string' && String((payload as any).name).trim()) || path.basename(file.originalname, '.json');

  const result = await importPromptPresetJSON({ stPayload: payload, userId, name });

  if (!result.success) {
    throw new AppError({
      status: 400,
      message: result.error,
      code: result.code,
      data: { jobId: result.jobId },
      warnings: result.warnings,
    });
  }

  return res.status(201).json({
    success: true,
    jobId: result.jobId,
    presetId: result.presetId,
    warnings: result.warnings,
  });
});

// 最小列表接口：列出已导入的 presets（给导入/选择页使用）
router.get('/preset', async (_req: AuthRequest, res) => {
  const database = await getDb();
  const stmt = database.prepare(
    'SELECT id, name, is_default, created_at, ' +
      'COALESCE((SELECT COUNT(*) FROM preset_prompts WHERE preset_id = presets.id), 0) AS prompt_count ' +
      'FROM presets ORDER BY created_at DESC LIMIT 50'
  );

  const rows: Array<{ id: number; name: string; is_default: number; created_at: number | null; prompt_count: number }> = [];

  while (stmt.step()) {
    const obj = stmt.getAsObject() as Record<string, unknown>;
    rows.push({
      id: Number(obj.id),
      name: String(obj.name || '未命名预设'),
      is_default: Number(obj.is_default || 0),
      created_at: obj.created_at == null ? null : Number(obj.created_at),
      prompt_count: Number(obj.prompt_count || 0),
    });
  }
  stmt.free();

  return res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      isDefault: r.is_default,
      createdAt: r.created_at,
      promptCount: r.prompt_count,
    }))
  );
});

// 导入 Regex Rules（ST Regex Rules / rules array）
router.post('/regex', upload.single('file'), async (req: AuthRequest, res) => {
  const file = req.file;
  if (!file) {
    throw new AppError({ status: 400, message: 'File is required', code: errorCodes.VALIDATION_ERROR });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.json' && file.mimetype !== 'application/json' && file.mimetype !== 'text/plain') {
    throw new AppError({ status: 400, message: 'Unsupported file type', code: errorCodes.VALIDATION_ERROR });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(file.buffer.toString('utf8'));
  } catch (e: any) {
    throw new AppError({
      status: 400,
      message: 'Invalid JSON format',
      code: errorCodes.ST_VALIDATION_FAILED,
      cause: e,
    });
  }

  const userId = req.user?.userId;
  const name = (typeof (payload as any)?.name === 'string' && String((payload as any).name).trim()) || path.basename(file.originalname, '.json');

  const result = await importRegexRulesJSON({ stPayload: payload, userId, name });

  if (!result.success) {
    throw new AppError({
      status: 400,
      message: result.error,
      code: result.code,
      data: { jobId: result.jobId },
      warnings: result.warnings,
    });
  }

  return res.status(201).json({
    success: true,
    jobId: result.jobId,
    rulesetId: result.rulesetId,
    warnings: result.warnings,
  });
});

// 最小列表接口：列出已导入的 regex_rulesets
router.get('/regex', async (_req: AuthRequest, res) => {
  const database = await getDb();
  const stmt = database.prepare('SELECT id, name, data, created_at FROM regex_rulesets ORDER BY created_at DESC LIMIT 50');

  const rows: Array<{ id: number; name: string; created_at: number | null; rule_count: number }> = [];

  while (stmt.step()) {
    const obj = stmt.getAsObject() as Record<string, unknown>;
    let rule_count = 0;
    try {
      const dataStr = obj.data ? String(obj.data) : '{}';
      const parsed = JSON.parse(dataStr);
      if (Array.isArray(parsed?.rules)) {
        rule_count = parsed.rules.length;
      } else if (Array.isArray(parsed)) {
        rule_count = parsed.length;
      }
    } catch {
      // ignore
    }

    rows.push({
      id: Number(obj.id),
      name: String(obj.name || '未命名正则规则集'),
      created_at: obj.created_at == null ? null : Number(obj.created_at),
      rule_count,
    });
  }

  stmt.free();

  return res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      ruleCount: r.rule_count,
    }))
  );
});

export default router;

