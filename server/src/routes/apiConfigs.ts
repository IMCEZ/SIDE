import { Router } from 'express';
import { getDb, saveDb } from '../db';
import { authMiddleware, type AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', async (_req: AuthRequest, res) => {
  try {
    const database = await getDb();
    const stmt = database.prepare(
      'SELECT id, name, provider, endpoint, api_key, model, is_active, created_at FROM api_configs ORDER BY created_at DESC'
    );

    const rows: Array<{
      id: number;
      name: string;
      provider: string;
      endpoint: string;
      api_key: string | null;
      model: string;
      is_active: number;
      created_at: number;
    }> = [];

    while (stmt.step()) {
      const obj = stmt.getAsObject() as Record<string, unknown>;
      rows.push({
        id: Number(obj.id),
        name: String(obj.name || ''),
        provider: String(obj.provider || ''),
        endpoint: obj.endpoint == null ? '' : String(obj.endpoint),
        api_key: obj.api_key == null ? null : String(obj.api_key),
        model: obj.model == null ? '' : String(obj.model),
        is_active: Number(obj.is_active || 0),
        created_at: Number(obj.created_at),
      });
    }
    stmt.free();

    const configs = rows.map((row) => ({
      id: row.id,
      name: row.name,
      provider: row.provider,
      endpoint: row.endpoint,
      model: row.model,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      apiKey: row.api_key ? '***' : '',
    }));

    return res.json(configs);
  } catch (e: any) {
    console.error('获取 API 配置失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to fetch api configs' });
  }
});

router.get('/active', async (_req: AuthRequest, res) => {
  try {
    const database = await getDb();
    const stmt = database.prepare(
      'SELECT id, name, provider, endpoint, api_key, model, is_active, created_at FROM api_configs WHERE is_active = 1 LIMIT 1'
    );

    let row: any = null;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();

    if (!row) {
      return res.status(404).json({ error: 'No active config' });
    }

    return res.json({
      id: Number(row.id),
      name: String(row.name || ''),
      provider: String(row.provider || ''),
      endpoint: row.endpoint == null ? '' : String(row.endpoint),
      apiKey: row.api_key == null ? '' : String(row.api_key),
      model: row.model == null ? '' : String(row.model),
      isActive: Number(row.is_active || 0) === 1,
      createdAt: Number(row.created_at),
    });
  } catch (e: any) {
    console.error('获取激活配置失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to fetch active config' });
  }
});

router.get('/providers', async (_req: AuthRequest, res) => {
  const providers = [
    {
      id: 'openai',
      name: 'OpenAI',
      provider: 'openai-compatible',
      defaultEndpoint: 'https://api.openai.com/v1',
      requiresApiKey: true,
      description: 'GPT-4o, GPT-4.1, o4-mini 等',
    },
    {
      id: 'deepseek',
      name: 'Deepseek',
      provider: 'openai-compatible',
      defaultEndpoint: 'https://api.deepseek.com/v1',
      requiresApiKey: true,
      description: 'deepseek-chat, deepseek-reasoner',
    },
    {
      id: 'moonshot',
      name: 'Moonshot (Kimi)',
      provider: 'openai-compatible',
      defaultEndpoint: 'https://api.moonshot.cn/v1',
      requiresApiKey: true,
      description: 'moonshot-v1-8k/32k/128k',
    },
    {
      id: 'groq',
      name: 'Groq',
      provider: 'openai-compatible',
      defaultEndpoint: 'https://api.groq.com/openai/v1',
      requiresApiKey: true,
      description: 'llama3, mixtral 等（极速推理）',
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      provider: 'openai-compatible',
      defaultEndpoint: 'https://openrouter.ai/api/v1',
      requiresApiKey: true,
      description: '聚合平台，支持数百种模型',
    },
    {
      id: 'siliconflow',
      name: '硅基流动 (SiliconFlow)',
      provider: 'openai-compatible',
      defaultEndpoint: 'https://api.siliconflow.cn/v1',
      requiresApiKey: true,
      description: '国内聚合平台，Qwen/GLM/DeepSeek 等',
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      provider: 'gemini',
      defaultEndpoint: 'https://generativelanguage.googleapis.com',
      requiresApiKey: true,
      description: 'Gemini 2.5 Pro/Flash 等',
    },
    {
      id: 'claude',
      name: 'Anthropic Claude',
      provider: 'claude',
      defaultEndpoint: 'https://api.anthropic.com',
      requiresApiKey: true,
      description: 'Claude Sonnet 4, Claude 3.5 等',
    },
    {
      id: 'ollama',
      name: 'Ollama (本地)',
      provider: 'ollama',
      defaultEndpoint: 'http://localhost:11434',
      requiresApiKey: false,
      description: '本地运行的开源模型',
    },
    {
      id: 'custom',
      name: '自定义 OpenAI 兼容',
      provider: 'openai-compatible',
      defaultEndpoint: '',
      requiresApiKey: true,
      description: '任意兼容 OpenAI 格式的第三方接口',
    },
  ];
  return res.json(providers);
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const database = await getDb();
    const stmt = database.prepare(
      'SELECT id, name, provider, endpoint, api_key, model, is_active, created_at FROM api_configs WHERE id = ? LIMIT 1'
    );
    stmt.bind([id]);

    let row: Record<string, unknown> | null = null;
    if (stmt.step()) {
      row = stmt.getAsObject() as Record<string, unknown>;
    }
    stmt.free();

    if (!row) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.json({
      id: Number(row.id),
      name: String(row.name || ''),
      provider: String(row.provider || ''),
      endpoint: row.endpoint == null ? '' : String(row.endpoint),
      model: row.model == null ? '' : String(row.model),
      isActive: Number(row.is_active || 0) === 1,
      createdAt: Number(row.created_at),
      apiKey: row.api_key ? '***' : '',
    });
  } catch (e: any) {
    console.error('获取 API 配置失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to fetch api config' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, provider, endpoint, api_key, model } = req.body as {
      name?: string;
      provider?: string;
      endpoint?: string;
      api_key?: string;
      model?: string;
    };

    const validProviders = ['openai-compatible', 'gemini', 'claude', 'ollama']
    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: 'Provider must be one of "openai-compatible", "gemini", "claude" or "ollama"' });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!endpoint || typeof endpoint !== 'string' || !endpoint.trim()) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

    if (!model || typeof model !== 'string' || !model.trim()) {
      return res.status(400).json({ error: 'Model is required' });
    }

    if (provider === 'openai-compatible' && (!api_key || typeof api_key !== 'string' || !api_key.trim())) {
      return res.status(400).json({ error: 'API key is required for openai-compatible provider' });
    }

    const database = await getDb();
    const now = Date.now();

    const insertStmt = database.prepare(
      'INSERT INTO api_configs (name, provider, endpoint, api_key, model, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insertStmt.run([name.trim(), provider, endpoint.trim(), api_key?.trim() || null, model.trim(), 0, now]);
    insertStmt.free();

    const idRes = database.exec('SELECT last_insert_rowid() AS id');
    const id = Number(idRes?.[0]?.values?.[0]?.[0]);

    saveDb();

    return res.status(201).json({
      id,
      name: name.trim(),
      provider,
      endpoint: endpoint.trim(),
      api_key: api_key ? '***' : null,
      model: model.trim(),
      is_active: 0,
      created_at: now,
    });
  } catch (e: any) {
    console.error('创建 API 配置失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to create api config' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const { name, provider, endpoint, api_key, model } = req.body as {
      name?: string;
      provider?: string;
      endpoint?: string;
      api_key?: string;
      model?: string;
    };

    const validProviders = ['openai-compatible', 'gemini', 'claude', 'ollama']
    if (provider !== undefined && !validProviders.includes(provider)) {
      return res.status(400).json({ error: 'Provider must be one of "openai-compatible", "gemini", "claude" or "ollama"' });
    }

    const database = await getDb();

    const selectStmt = database.prepare('SELECT id FROM api_configs WHERE id = ? LIMIT 1');
    selectStmt.bind([id]);
    let exists = false;
    if (selectStmt.step()) exists = true;
    selectStmt.free();

    if (!exists) {
      return res.status(404).json({ error: 'Not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (provider !== undefined) {
      updates.push('provider = ?');
      values.push(provider);
    }

    if (endpoint !== undefined) {
      if (typeof endpoint !== 'string' || !endpoint.trim()) {
        return res.status(400).json({ error: 'Endpoint cannot be empty' });
      }
      updates.push('endpoint = ?');
      values.push(endpoint.trim());
    }

    if (api_key !== undefined) {
      updates.push('api_key = ?');
      values.push(api_key?.trim() || null);
    }

    if (model !== undefined) {
      if (typeof model !== 'string' || !model.trim()) {
        return res.status(400).json({ error: 'Model cannot be empty' });
      }
      updates.push('model = ?');
      values.push(model.trim());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const stmt = database.prepare(`UPDATE api_configs SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(values);
    stmt.free();

    saveDb();

    return res.json({ id, message: 'Updated successfully' });
  } catch (e: any) {
    console.error('更新 API 配置失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to update api config' });
  }
});

router.put('/:id/activate', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const database = await getDb();

    const selectStmt = database.prepare('SELECT id FROM api_configs WHERE id = ? LIMIT 1');
    selectStmt.bind([id]);
    let exists = false;
    if (selectStmt.step()) exists = true;
    selectStmt.free();

    if (!exists) {
      return res.status(404).json({ error: 'Not found' });
    }

    database.run('UPDATE api_configs SET is_active = 0 WHERE is_active = 1');

    const updateStmt = database.prepare('UPDATE api_configs SET is_active = 1 WHERE id = ?');
    updateStmt.run([id]);
    updateStmt.free();

    saveDb();

    return res.json({ id, message: 'Activated successfully' });
  } catch (e: any) {
    console.error('激活 API 配置失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to activate api config' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const database = await getDb();

    const selectStmt = database.prepare('SELECT id FROM api_configs WHERE id = ? LIMIT 1');
    selectStmt.bind([id]);
    let exists = false;
    if (selectStmt.step()) exists = true;
    selectStmt.free();

    if (!exists) {
      return res.status(404).json({ error: 'Not found' });
    }

    const deleteStmt = database.prepare('DELETE FROM api_configs WHERE id = ?');
    deleteStmt.run([id]);
    deleteStmt.free();

    saveDb();

    return res.status(204).send();
  } catch (e: any) {
    console.error('删除 API 配置失败:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to delete api config' });
  }
});

router.post('/models', async (req: AuthRequest, res) => {
  const { provider, endpoint, apiKey } = req.body
  if (!provider) return res.status(400).json({ error: 'provider is required' })
  
  try {
    const { fetchModelList } = await import('../services/llm')
    const models = await fetchModelList(provider, endpoint || '', apiKey || '')
    return res.json({ models })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? '获取模型列表失败' })
  }
})

/** 按配置 id 拉模型列表（供 hooks / 旧 UI 连接测试） */
router.post('/:id/test', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const database = await getDb();
    const stmt = database.prepare(
      'SELECT provider, endpoint, api_key FROM api_configs WHERE id = ? LIMIT 1'
    );
    stmt.bind([id]);

    let row: Record<string, unknown> | null = null;
    if (stmt.step()) {
      row = stmt.getAsObject() as Record<string, unknown>;
    }
    stmt.free();

    if (!row) {
      return res.status(404).json({ error: 'Not found' });
    }

    const provider = String(row.provider || '');
    const endpoint = row.endpoint == null ? '' : String(row.endpoint);
    const apiKey = row.api_key == null ? '' : String(row.api_key);

    const { fetchModelList } = await import('../services/llm');
    const models = await fetchModelList(
      provider as import('../services/llm').Provider,
      endpoint,
      apiKey || undefined
    );

    return res.json({
      success: true,
      message: `连接成功，可用模型 ${models.length} 个`,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message ?? '连接测试失败',
    });
  }
});

export default router;