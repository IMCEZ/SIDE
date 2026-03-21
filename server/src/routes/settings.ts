import { Router } from 'express';
import { getDb, saveDb } from '../db';
import { authMiddleware, type AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

type ApiProfilePayload = {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  enabled?: boolean;
};

type ModelFetchErrorCode = 'NETWORK_ERROR' | 'AUTH_ERROR' | 'RESPONSE_ERROR' | 'EMPTY_LIST';

class ModelFetchError extends Error {
  code: ModelFetchErrorCode;
  status: number;

  constructor(code: ModelFetchErrorCode, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

async function fetchOpenAICompatibleModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const endpoint = normalizeBaseUrl(baseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    let response: Response;
    try {
      response = await fetch(`${endpoint}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new ModelFetchError('NETWORK_ERROR', 504, '网络请求超时，请检查网络或服务地址');
      }
      throw new ModelFetchError('NETWORK_ERROR', 502, '网络请求失败，请检查网络或服务地址');
    }

    if (response.status === 401 || response.status === 403) {
      throw new ModelFetchError('AUTH_ERROR', response.status, '认证失败，请检查 API Key');
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const message = body || `请求失败，状态码 ${response.status}`;
      throw new ModelFetchError('RESPONSE_ERROR', 502, `响应错误：${message}`);
    }

    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new ModelFetchError('RESPONSE_ERROR', 502, '响应结构错误：返回内容不是合法 JSON');
    }

    if (!Array.isArray(json?.data)) {
      throw new ModelFetchError('RESPONSE_ERROR', 502, '响应结构错误：缺少 data 数组');
    }

    const models = json.data
      .map((item: any) => item?.id)
      .filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
      .sort((a: string, b: string) => a.localeCompare(b));

    if (models.length === 0) {
      throw new ModelFetchError('EMPTY_LIST', 422, '模型列表为空');
    }

    return models;
  } finally {
    clearTimeout(timeoutId);
  }
}

router.get('/', async (_req: AuthRequest, res) => {
  const database = await getDb();
  const stmt = database.prepare('SELECT key, value FROM settings');

  const data: Record<string, string | null> = {};
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    data[String(row.key)] = row.value == null ? null : String(row.value);
  }
  stmt.free();
  return res.json(data);
});

router.put('/', async (req: AuthRequest, res) => {
  const body = req.body as { key: string; value: string }[];
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const database = await getDb();
  const now = Date.now();

  const stmt = database.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const item of body) {
    if (!item.key) continue;
    stmt.run([item.key, item.value]);
  }
  stmt.free();

  saveDb();
  return res.json({ updatedAt: now });
});

router.get('/api-profile/current', async (_req: AuthRequest, res) => {
  try {
    const database = await getDb();
    const stmt = database.prepare(
      'SELECT id, provider, endpoint, api_key, model, is_active, created_at FROM api_profiles ORDER BY is_active DESC, created_at DESC LIMIT 1'
    );

    let row: Record<string, unknown> | null = null;
    if (stmt.step()) {
      row = stmt.getAsObject() as Record<string, unknown>;
    }
    stmt.free();

    if (!row) {
      return res.json(null);
    }

    return res.json({
      id: Number(row.id),
      provider: String(row.provider || ''),
      baseUrl: row.endpoint == null ? '' : String(row.endpoint),
      apiKeyMasked: row.api_key ? '***' : '',
      hasApiKey: Boolean(row.api_key),
      defaultModel: row.model == null ? '' : String(row.model),
      enabled: Number(row.is_active || 0) === 1,
      createdAt: Number(row.created_at || 0),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'Failed to get api profile' });
  }
});

router.put('/api-profile/current', async (req: AuthRequest, res) => {
  try {
    const { provider, baseUrl, apiKey, defaultModel, enabled } = req.body as ApiProfilePayload;

    if (provider !== 'openai-compatible') {
      return res.status(400).json({ error: '当前仅支持 openai-compatible provider' });
    }

    if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
      return res.status(400).json({ error: 'baseUrl is required' });
    }

    if (!defaultModel || typeof defaultModel !== 'string' || !defaultModel.trim()) {
      return res.status(400).json({ error: 'defaultModel is required' });
    }

    const database = await getDb();
    const now = Date.now();

    const selectStmt = database.prepare(
      'SELECT id, api_key FROM api_profiles ORDER BY is_active DESC, created_at DESC LIMIT 1'
    );

    let current: Record<string, unknown> | null = null;
    if (selectStmt.step()) {
      current = selectStmt.getAsObject() as Record<string, unknown>;
    }
    selectStmt.free();

    const currentApiKey = current?.api_key == null ? '' : String(current.api_key);
    const finalApiKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : currentApiKey;

    if (!finalApiKey) {
      return res.status(400).json({ error: 'apiKey is required' });
    }

    const finalEnabled = enabled === false ? 0 : 1;

    if (current?.id != null) {
      const stmt = database.prepare(
        'UPDATE api_profiles SET provider = ?, endpoint = ?, api_key = ?, model = ?, is_active = ?, created_at = ? WHERE id = ?'
      );
      stmt.run([
        'openai-compatible',
        normalizeBaseUrl(baseUrl),
        finalApiKey,
        defaultModel.trim(),
        finalEnabled,
        now,
        Number(current.id),
      ]);
      stmt.free();
    } else {
      const stmt = database.prepare(
        'INSERT INTO api_profiles (name, provider, endpoint, api_key, model, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      stmt.run([
        'default',
        'openai-compatible',
        normalizeBaseUrl(baseUrl),
        finalApiKey,
        defaultModel.trim(),
        finalEnabled,
        now,
      ]);
      stmt.free();
    }

    saveDb();

    return res.json({
      success: true,
      provider: 'openai-compatible',
      baseUrl: normalizeBaseUrl(baseUrl),
      apiKeyMasked: '***',
      hasApiKey: true,
      defaultModel: defaultModel.trim(),
      enabled: finalEnabled === 1,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'Failed to save api profile' });
  }
});

router.post('/api-profile/current/test', async (req: AuthRequest, res) => {
  try {
    const { provider, baseUrl, apiKey } = req.body as ApiProfilePayload;

    if (provider !== 'openai-compatible') {
      return res.status(400).json({ code: 'RESPONSE_ERROR', error: '当前仅支持 openai-compatible provider' });
    }

    if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
      return res.status(400).json({ code: 'RESPONSE_ERROR', error: 'baseUrl is required' });
    }

    const database = await getDb();
    const keyStmt = database.prepare('SELECT api_key FROM api_profiles ORDER BY is_active DESC, created_at DESC LIMIT 1');
    let dbApiKey = '';
    if (keyStmt.step()) {
      const row = keyStmt.getAsObject() as Record<string, unknown>;
      dbApiKey = row.api_key == null ? '' : String(row.api_key);
    }
    keyStmt.free();

    const finalApiKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : dbApiKey;

    if (!finalApiKey) {
      return res.status(400).json({ code: 'AUTH_ERROR', error: 'apiKey is required' });
    }

    const models = await fetchOpenAICompatibleModels(baseUrl, finalApiKey);

    return res.json({
      success: true,
      message: `连接成功，可用模型 ${models.length} 个`,
    });
  } catch (e: any) {
    if (e instanceof ModelFetchError) {
      return res.status(e.status).json({ code: e.code, error: e.message });
    }
    return res.status(500).json({ code: 'RESPONSE_ERROR', error: e?.message ?? '连接测试失败' });
  }
});

router.post('/api-profile/current/models', async (req: AuthRequest, res) => {
  try {
    const { provider, baseUrl, apiKey } = req.body as ApiProfilePayload;

    if (provider !== 'openai-compatible') {
      return res.status(400).json({ code: 'RESPONSE_ERROR', error: '当前仅支持 openai-compatible provider' });
    }

    if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
      return res.status(400).json({ code: 'RESPONSE_ERROR', error: 'baseUrl is required' });
    }

    const database = await getDb();
    const keyStmt = database.prepare('SELECT api_key FROM api_profiles ORDER BY is_active DESC, created_at DESC LIMIT 1');
    let dbApiKey = '';
    if (keyStmt.step()) {
      const row = keyStmt.getAsObject() as Record<string, unknown>;
      dbApiKey = row.api_key == null ? '' : String(row.api_key);
    }
    keyStmt.free();

    const finalApiKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : dbApiKey;

    if (!finalApiKey) {
      return res.status(400).json({ code: 'AUTH_ERROR', error: 'apiKey is required' });
    }

    const models = await fetchOpenAICompatibleModels(baseUrl, finalApiKey);
    return res.json({ models });
  } catch (e: any) {
    if (e instanceof ModelFetchError) {
      return res.status(e.status).json({ code: e.code, error: e.message });
    }
    return res.status(500).json({ code: 'RESPONSE_ERROR', error: e?.message ?? '获取模型列表失败' });
  }
});

router.get('/:key', async (req: AuthRequest, res) => {
  const key = req.params.key;

  const database = await getDb();
  const stmt = database.prepare('SELECT key, value FROM settings WHERE key = ? LIMIT 1');
  stmt.bind([key]);

  let row: any = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();

  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.json({ key: row.key, value: row.value });
});

export default router;
