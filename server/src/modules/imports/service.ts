import { getDb, saveDb } from '../../db';
import { errorCodes } from '../../core/errors/errorCodes';
import type { ImportRequest, ImportResult } from './types';
import type { ApiWarning } from '../../core/http/apiResponse';
import { validateCharacterCardV3, validatePromptPreset, validateRegexRules, validateWorldBookV1 } from '../st/validators';
import { normalizeStResourceKind } from '../st/normalizers';
import type { NormalizedPreset } from '../st/normalizers';
import type { NormalizedRegexRuleset } from '../st/normalizers';
import type { ImportNormalizedData, NormalizedCharacter } from '../st/types';
import type { NormalizedWorldbook } from '../st/types';

export type ImportCharacterCardResult = {
  jobId: number;
  characterId: number;
  warnings?: ImportNormalizedData extends any ? any : never;
  // skeleton：路由层直接映射为统一响应
};

export type ImportWorldbookResult = {
  jobId: number;
  worldbookId: number;
  warnings?: import('../../core/http/apiResponse').ApiWarning[];
};

export type ImportWorldbookFailure = {
  success: false;
  jobId: number;
  error: string;
  code?: (typeof errorCodes)[keyof typeof errorCodes];
  warnings?: import('../../core/http/apiResponse').ApiWarning[];
};

export type ImportWorldbookSuccess = {
  success: true;
  jobId: number;
  worldbookId: number;
  warnings?: import('../../core/http/apiResponse').ApiWarning[];
};

/**
 * Character Card（chara_card_v3）JSON 导入（本步实现）
 * - 不处理 PNG
 * - 允许不完整字段：返回 warnings
 * - 必须保留 character_book（可解析 entries，否则保留 raw）
 */
export async function importCharacterCardJSON(request: {
  stPayload: unknown;
  userId?: number;
}): Promise<
  | {
      success: true;
      jobId: number;
      characterId: number;
      warnings?: import('../../core/http/apiResponse').ApiWarning[];
    }
  | {
      success: false;
      jobId: number;
      error: string;
      code?: (typeof errorCodes)[keyof typeof errorCodes];
      warnings?: import('../../core/http/apiResponse').ApiWarning[];
    }
> {
  const database = await getDb();
  const now = Date.now();

  // 1) 创建 import_jobs 记录
  const insertJobStmt = database.prepare(
    'INSERT INTO import_jobs (user_id, resource_kind, status, raw_data, normalized_data, error_text, created_at, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertJobStmt.run([
    request.userId ?? null,
    'character_card',
    'processing',
    null,
    null,
    null,
    now,
    now
  ]);
  insertJobStmt.free();

  const idRes = database.exec('SELECT last_insert_rowid() AS id');
  const jobId = Number(idRes?.[0]?.values?.[0]?.[0]);

  const finalizeJobSuccess = (normalizedData: NormalizedCharacter, warnings?: any[]) => {
    const updateStmt = database.prepare(
      'UPDATE import_jobs SET status = ?, normalized_data = ?, raw_data = ?, finished_at = ? WHERE id = ?'
    );
    updateStmt.run([
      'succeeded',
      JSON.stringify(normalizedData),
      JSON.stringify(request.stPayload),
      Date.now(),
      jobId
    ]);
    updateStmt.free();
  };

  const finalizeJobFailure = (errorText: string) => {
    const updateStmt = database.prepare(
      'UPDATE import_jobs SET status = ?, error_text = ?, finished_at = ? WHERE id = ?'
    );
    updateStmt.run(['failed', errorText, Date.now(), jobId]);
    updateStmt.free();
  };

  // 2) 校验
  const v = validateCharacterCardV3(request.stPayload);
  if (!v.ok) {
    finalizeJobFailure(v.errors.join('; '));
    return { success: false, jobId, error: v.errors.join('; '), code: v.code };
  }

  // 3) 归一化
  const n = normalizeStResourceKind('character_card', request.stPayload);
  if (!n.ok || n.value.kind !== 'character_card') {
    finalizeJobFailure(n.ok ? 'Normalization failed' : n.errors.join('; '));
    return {
      success: false,
      jobId,
      error: n.ok ? 'Normalization failed' : n.errors.join('; '),
      code: errorCodes.ST_NORMALIZATION_FAILED,
    };
  }

  const normalizedCharacter = n.value.normalizedData;
  const warnings = v.warnings;

  // 4) 写入 characters
  const storedData = {
    ...normalizedCharacter,
    // rawData 已经在 normalizedCharacter.rawData 中，但显式保留确保不丢
    rawData: request.stPayload,
  };

  const insertCharacterStmt = database.prepare(
    'INSERT INTO characters (name, file_path, data, avatar_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertCharacterStmt.run([
    normalizedCharacter.name,
    null,
    JSON.stringify(storedData),
    null,
    now,
    now
  ]);
  insertCharacterStmt.free();

  const charIdRes = database.exec('SELECT last_insert_rowid() AS id');
  const characterId = Number(charIdRes?.[0]?.values?.[0]?.[0]);

  // 5) 更新 import_jobs：normalized/raw + finished_at
  finalizeJobSuccess(normalizedCharacter, warnings);
  saveDb();

  return {
    success: true,
    jobId,
    characterId,
    warnings: warnings?.length ? warnings : undefined,
  };
}

/**
 * World Book（world_book_v1）JSON 导入（本步实现）
 * - PNG 不支持
 * - entries 拆行写入 worldbook_entries
 */
export async function importWorldbookV1JSON(request: {
  stPayload: unknown;
  userId?: number;
}): Promise<ImportWorldbookSuccess | ImportWorldbookFailure> {
  const database = await getDb();
  const now = Date.now();

  // 1) 创建 import_jobs 记录
  const insertJobStmt = database.prepare(
    'INSERT INTO import_jobs (user_id, resource_kind, status, raw_data, normalized_data, error_text, created_at, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertJobStmt.run([
    request.userId ?? null,
    'world_book',
    'processing',
    null,
    null,
    null,
    now,
    now,
  ]);
  insertJobStmt.free();

  const idRes = database.exec('SELECT last_insert_rowid() AS id');
  const jobId = Number(idRes?.[0]?.values?.[0]?.[0]);

  const finalizeJobSuccess = (normalizedWorldbook: NormalizedWorldbook, warnings?: any[]) => {
    const updateStmt = database.prepare(
      'UPDATE import_jobs SET status = ?, normalized_data = ?, raw_data = ?, finished_at = ? WHERE id = ?'
    );
    updateStmt.run([
      'succeeded',
      JSON.stringify(normalizedWorldbook),
      JSON.stringify(request.stPayload),
      Date.now(),
      jobId,
    ]);
    updateStmt.free();
  };

  const finalizeJobFailure = (errorText: string) => {
    const updateStmt = database.prepare(
      'UPDATE import_jobs SET status = ?, error_text = ?, finished_at = ? WHERE id = ?'
    );
    updateStmt.run(['failed', errorText, Date.now(), jobId]);
    updateStmt.free();
  };

  // 2) 校验 + warnings
  const v = validateWorldBookV1(request.stPayload);
  if (!v.ok) {
    finalizeJobFailure(v.errors.join('; '));
    return { success: false, jobId, error: v.errors.join('; '), code: v.code };
  }

  const warnings = v.warnings;

  // 3) 归一化
  const n = normalizeStResourceKind('world_book', request.stPayload);
  if (!n.ok || n.value.kind !== 'world_book') {
    finalizeJobFailure(n.ok ? 'Normalization failed' : n.errors.join('; '));
    return {
      success: false,
      jobId,
      error: n.ok ? 'Normalization failed' : n.errors.join('; '),
      code: errorCodes.ST_NORMALIZATION_FAILED,
    };
  }

  const normalizedWorldbook = n.value.normalizedData;

  // 4) 写入 worldbooks + worldbook_entries
  const insertWorldbookStmt = database.prepare(
    'INSERT INTO worldbooks (name, description, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  );
  insertWorldbookStmt.run([
    normalizedWorldbook.name,
    normalizedWorldbook.description ?? null,
    JSON.stringify(normalizedWorldbook),
    now,
    now,
  ]);
  insertWorldbookStmt.free();

  const worldIdRes = database.exec('SELECT last_insert_rowid() AS id');
  const worldbookId = Number(worldIdRes?.[0]?.values?.[0]?.[0]);

  const insertEntryStmt = database.prepare(
    'INSERT INTO worldbook_entries (worldbook_id, keys, content, entry_order, enabled, position, probability, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  for (const e of normalizedWorldbook.entries) {
    insertEntryStmt.run([
      worldbookId,
      JSON.stringify(e.key),
      e.content,
      e.order,
      e.disable ? 0 : 1,
      String(e.position),
      null,
      JSON.stringify(e),
      now,
    ]);
  }
  insertEntryStmt.free();

  finalizeJobSuccess(normalizedWorldbook, warnings);
  saveDb();

  return {
    success: true,
    jobId,
    worldbookId,
    warnings: warnings?.length ? warnings : undefined,
  };
}

export type ImportPromptPresetResult =
  | {
      success: true;
      jobId: number;
      presetId: number;
      warnings?: ApiWarning[];
    }
  | {
      success: false;
      jobId: number;
      error: string;
      code?: (typeof errorCodes)[keyof typeof errorCodes];
      warnings?: ApiWarning[];
    };

/**
 * Prompt Preset（ST Prompt Preset）JSON 导入
 * - 宽松校验 + 标准化 prompts/prompt_order
 * - 写入 presets（SIDE 运行时所需 params/promptOrder）
 * - 如果 schema 允许：写入 preset_prompts（保留富字段）
 */
export async function importPromptPresetJSON(request: {
  stPayload: unknown;
  userId?: number;
  name?: string;
}): Promise<ImportPromptPresetResult> {
  const database = await getDb();
  const now = Date.now();

  // 1) 创建 import_jobs 记录
  const insertJobStmt = database.prepare(
    'INSERT INTO import_jobs (user_id, resource_kind, status, raw_data, normalized_data, error_text, created_at, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertJobStmt.run([
    request.userId ?? null,
    'prompt_preset',
    'processing',
    null,
    null,
    null,
    now,
    now,
  ]);
  insertJobStmt.free();

  const idRes = database.exec('SELECT last_insert_rowid() AS id');
  const jobId = Number(idRes?.[0]?.values?.[0]?.[0]);

  const finalizeJobSuccess = (normalizedData: NormalizedPreset) => {
    const updateStmt = database.prepare(
      'UPDATE import_jobs SET status = ?, normalized_data = ?, raw_data = ?, finished_at = ? WHERE id = ?'
    );
    updateStmt.run([
      'succeeded',
      JSON.stringify(normalizedData),
      JSON.stringify(request.stPayload),
      Date.now(),
      jobId,
    ]);
    updateStmt.free();
  };

  const finalizeJobFailure = (errorText: string) => {
    const updateStmt = database.prepare('UPDATE import_jobs SET status = ?, error_text = ?, finished_at = ? WHERE id = ?');
    updateStmt.run(['failed', errorText, Date.now(), jobId]);
    updateStmt.free();
  };

  // 2) 校验 + warnings
  const v = validatePromptPreset(request.stPayload);
  if (!v.ok) {
    finalizeJobFailure(v.errors.join('; '));
    return { success: false, jobId, error: v.errors.join('; '), code: v.code };
  }
  const warnings = v.warnings;

  // 3) 归一化
  const n = normalizeStResourceKind('prompt_preset', request.stPayload);
  if (!n.ok || n.value.kind !== 'prompt_preset') {
    const errText = n.ok ? 'Normalization failed' : n.errors.join('; ');
    finalizeJobFailure(errText);
    return { success: false, jobId, error: errText, code: errorCodes.ST_NORMALIZATION_FAILED };
  }

  const normalizedPreset = n.value.normalizedData as unknown as NormalizedPreset;

  // 4) 生成 SIDE 运行时可用的 promptOrder（system/enabled/order/content）
  const effectiveOrderBlock =
    normalizedPreset.promptOrder.find((b) => b.character_id === 0) ??
    normalizedPreset.promptOrder[0] ??
    null;

  const orderIndexByIdentifier = new Map<string, number>();
  const enabledByIdentifier = new Map<string, boolean>();
  if (effectiveOrderBlock) {
    effectiveOrderBlock.order.forEach((o, idx) => {
      orderIndexByIdentifier.set(o.identifier, idx);
      enabledByIdentifier.set(o.identifier, o.enabled);
    });
  }

  const blockByIdentifier = new Map(
    normalizedPreset.prompts.map((p, fallbackIdx) => {
      const order = orderIndexByIdentifier.has(p.identifier) ? orderIndexByIdentifier.get(p.identifier)! : fallbackIdx;
      const enabled = enabledByIdentifier.has(p.identifier) ? enabledByIdentifier.get(p.identifier)! : p.enabled;
      const system = p.system_prompt === true || p.role === 'system';
      return [
        p.identifier,
        {
          identifier: p.identifier,
          name: p.name,
          content: p.content,
          enabled,
          system,
          order,
        },
      ] as const;
    })
  );

  const promptOrder = Array.from(blockByIdentifier.values()).sort((a, b) => a.order - b.order);

  const presetData = {
    params: normalizedPreset.params,
    promptOrder,
    // 额外保留 ST 标准化结果，便于前端二次展示/调试
    st: {
      prompts: normalizedPreset.prompts,
      promptOrder: normalizedPreset.promptOrder,
    },
  };

  // 5) 写入 presets
  const presetName =
    (request.name && request.name.trim()) ||
    (typeof (request.stPayload as any)?.name === 'string' && String((request.stPayload as any).name).trim()) ||
    'Imported Prompt Preset';

  const insertPresetStmt = database.prepare('INSERT INTO presets (name, data, is_default, created_at) VALUES (?, ?, ?, ?)');
  insertPresetStmt.run([presetName, JSON.stringify(presetData), 0, now]);
  insertPresetStmt.free();

  const presetIdRes = database.exec('SELECT last_insert_rowid() AS id');
  const presetId = Number(presetIdRes?.[0]?.values?.[0]?.[0]);

  // 6) 写入 preset_prompts（保留系统提示的富字段）
  const insertPromptStmt = database.prepare(
    'INSERT INTO preset_prompts (preset_id, identifier, name, content, enabled, system, sort_order, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const promptBlockMap = new Map<string, (typeof promptOrder)[number]>();
  promptOrder.forEach((b) => promptBlockMap.set(b.identifier, b));

  for (const p of normalizedPreset.prompts) {
    const b = promptBlockMap.get(p.identifier);
    const enabled = b ? b.enabled : p.enabled;
    const system = b ? b.system : p.system_prompt;
    const order = b ? b.order : 0;

    insertPromptStmt.run([
      presetId,
      p.identifier,
      p.name,
      p.content,
      enabled ? 1 : 0,
      system ? 1 : 0,
      order,
      JSON.stringify({
        system_prompt: p.system_prompt,
        marker: p.marker,
        role: p.role,
        injection_position: p.injection_position,
        injection_depth: p.injection_depth,
        forbid_overrides: p.forbid_overrides,
        enabled: p.enabled,
        // 额外附带原始 prompt 节点（可能包含其它 ST 字段）
        raw: p.raw,
      }),
      now,
    ]);
  }

  insertPromptStmt.free();

  // 7) 更新 import_jobs：normalized/raw + finished_at
  finalizeJobSuccess(normalizedPreset);
  saveDb();

  return {
    success: true,
    jobId,
    presetId,
    warnings: warnings?.length ? warnings : undefined,
  };
}

export type ImportRegexRulesResult =
  | {
      success: true;
      jobId: number;
      rulesetId: number;
      warnings?: ApiWarning[];
    }
  | {
      success: false;
      jobId: number;
      error: string;
      code?: (typeof errorCodes)[keyof typeof errorCodes];
      warnings?: ApiWarning[];
    };

/**
 * Regex Rules（regex_rules）JSON 导入
 * - 顶层：数组（每项一个规则）
 * - 校验 placement / regex 可编译 / substitute(string|mapping)
 */
export async function importRegexRulesJSON(request: {
  stPayload: unknown;
  userId?: number;
  name?: string;
}): Promise<ImportRegexRulesResult> {
  const database = await getDb();
  const now = Date.now();

  // 1) 创建 import_jobs 记录
  const insertJobStmt = database.prepare(
    'INSERT INTO import_jobs (user_id, resource_kind, status, raw_data, normalized_data, error_text, created_at, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertJobStmt.run([
    request.userId ?? null,
    'regex_rules',
    'processing',
    null,
    null,
    null,
    now,
    now,
  ]);
  insertJobStmt.free();

  const idRes = database.exec('SELECT last_insert_rowid() AS id');
  const jobId = Number(idRes?.[0]?.values?.[0]?.[0]);

  const finalizeJobSuccess = (normalizedData: NormalizedRegexRuleset, warnings?: ApiWarning[]) => {
    const updateStmt = database.prepare(
      'UPDATE import_jobs SET status = ?, normalized_data = ?, raw_data = ?, finished_at = ? WHERE id = ?'
    );
    updateStmt.run(['succeeded', JSON.stringify(normalizedData), JSON.stringify(request.stPayload), Date.now(), jobId]);
    updateStmt.free();
  };

  const finalizeJobFailure = (errorText: string) => {
    const updateStmt = database.prepare('UPDATE import_jobs SET status = ?, error_text = ?, finished_at = ? WHERE id = ?');
    updateStmt.run(['failed', errorText, Date.now(), jobId]);
    updateStmt.free();
  };

  // 2) 校验 + warnings
  const v = validateRegexRules(request.stPayload);
  if (!v.ok) {
    finalizeJobFailure(v.errors.join('; '));
    return { success: false, jobId, error: v.errors.join('; '), code: v.code, warnings: v.warnings };
  }
  const warnings = v.warnings;

  // 3) 归一化
  const n = normalizeStResourceKind('regex_rules', request.stPayload);
  if (!n.ok || n.value.kind !== 'regex_rules') {
    const errText = n.ok ? 'Normalization failed' : n.errors.join('; ');
    finalizeJobFailure(errText);
    return { success: false, jobId, error: errText, code: errorCodes.ST_NORMALIZATION_FAILED, warnings };
  }

  const normalizedRuleset = n.value.normalizedData as unknown as NormalizedRegexRuleset;

  // 4) 写入 regex_rulesets（整套规则落在 data）
  const rulesetName =
    (request.name && request.name.trim()) || (normalizedRuleset.name && normalizedRuleset.name.trim()) || 'Imported Regex Ruleset';

  const insertStmt = database.prepare('INSERT INTO regex_rulesets (name, data, created_at) VALUES (?, ?, ?)');
  insertStmt.run([rulesetName, JSON.stringify(normalizedRuleset), now]);
  insertStmt.free();

  const idRes2 = database.exec('SELECT last_insert_rowid() AS id');
  const rulesetId = Number(idRes2?.[0]?.values?.[0]?.[0]);

  // 5) 更新 import_jobs：normalized/raw + finished_at
  finalizeJobSuccess(normalizedRuleset, warnings);
  saveDb();

  return {
    success: true,
    jobId,
    rulesetId,
    warnings: warnings?.length ? warnings : undefined,
  };
}

export async function importStResource(request: ImportRequest): Promise<ImportResult<ImportNormalizedData>> {
  const kind = request.kind;
  const payload = request.stPayload;

  // 本步只实现 character_card；其它资源先保留骨架，不落库
  switch (kind) {
    case 'character_card': {
      // 不落库版本：兼容未来调用方
      const v = validateCharacterCardV3(payload);
      if (!v.ok) {
        return { success: false, error: v.errors.join('; '), code: v.code };
      }
      const n = normalizeStResourceKind(kind, payload);
      if (!n.ok) {
        return { success: false, error: n.errors.join('; '), code: errorCodes.ST_NORMALIZATION_FAILED };
      }
      return { success: true, data: n.value, warnings: v.warnings };
    }
    case 'world_book': {
      const v = validateWorldBookV1(payload);
      if (!v.ok) {
        return { success: false, error: v.errors.join('; '), code: v.code };
      }
      const n = normalizeStResourceKind(kind, payload);
      if (!n.ok) return { success: false, error: n.errors.join('; '), code: errorCodes.ST_NORMALIZATION_FAILED };
      return { success: true, data: n.value, warnings: v.warnings };
    }
    case 'prompt_preset': {
      const v = validatePromptPreset(payload);
      if (!v.ok) {
        return { success: false, error: v.errors.join('; '), code: v.code };
      }
      const n = normalizeStResourceKind(kind, payload);
      if (!n.ok) return { success: false, error: n.errors.join('; '), code: errorCodes.ST_NORMALIZATION_FAILED };
      return { success: true, data: n.value, warnings: v.warnings };
    }
    case 'regex_rules': {
      const v = validateRegexRules(payload);
      if (!v.ok) {
        return { success: false, error: v.errors.join('; '), code: v.code };
      }
      const n = normalizeStResourceKind(kind, payload);
      if (!n.ok) return { success: false, error: n.errors.join('; '), code: errorCodes.ST_NORMALIZATION_FAILED };
      return { success: true, data: n.value, warnings: v.warnings };
    }
    default:
      return { success: false, error: 'Unsupported import kind', code: errorCodes.IMPORT_NOT_IMPLEMENTED };
  }
}

