import { getDb } from '../../db';
import { autoConvertPreset } from '../../utils/presetConverter';
import type { SIDEPresetData } from '../../utils/presetConverter';

type SessionRow = {
  id: number;
  user_id: number | null;
  character_id: number | null;
  preset_id: number | null;
  worldbook_ids: string | null;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function safeParseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return asObject(parsed) ?? {};
  } catch {
    return {};
  }
}

export function parseWorldbookIds(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v));
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

export type CharacterRuntimeParts = {
  description: string;
  personality: string;
  scenario: string;
  embeddedBookText: string;
  combinedNarrative: string;
  info: {
    hasDescription: boolean;
    hasPersonality: boolean;
    hasScenario: boolean;
    hasEmbeddedBook: boolean;
  };
};

export async function loadCharacterRuntimeParts(characterId: number | null): Promise<CharacterRuntimeParts> {
  const empty: CharacterRuntimeParts = {
    description: '',
    personality: '',
    scenario: '',
    embeddedBookText: '',
    combinedNarrative: '',
    info: {
      hasDescription: false,
      hasPersonality: false,
      hasScenario: false,
      hasEmbeddedBook: false,
    },
  };

  if (!characterId) return empty;

  const database = await getDb();
  const stmt = database.prepare('SELECT data FROM characters WHERE id = ? LIMIT 1');
  stmt.bind([characterId]);

  let row: Record<string, unknown> | null = null;
  if (stmt.step()) {
    row = stmt.getAsObject() as Record<string, unknown>;
  }
  stmt.free();

  if (!row?.data) return empty;

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(String(row.data)) as Record<string, unknown>;
  } catch {
    return empty;
  }

  const rootData = asObject(data.data);
  const description = asString(data.description || rootData?.description || '');
  const personality = asString(data.personality || rootData?.personality || '');
  const scenario = asString(data.scenario || rootData?.scenario || '');

  const embeddedBook = asObject(data.character_book || rootData?.character_book);
  const embeddedEntries = Array.isArray(embeddedBook?.entries) ? embeddedBook?.entries : [];

  const entryText = embeddedEntries
    .map((entry) => {
      const e = asObject(entry) ?? {};
      const keys = Array.isArray(e.key) ? e.key.map((k) => asString(k)).filter(Boolean).join(', ') : '';
      const content = asString(e.content);
      if (!content.trim()) return '';
      return keys ? `- [${keys}] ${content}` : `- ${content}`;
    })
    .filter(Boolean)
    .join('\n');

  const embeddedBookText = entryText.trim() ? entryText : '';

  const blocks: string[] = [];
  if (description.trim()) blocks.push(`角色描述:\n${description.trim()}`);
  if (personality.trim()) blocks.push(`角色性格:\n${personality.trim()}`);
  if (scenario.trim()) blocks.push(`角色场景:\n${scenario.trim()}`);
  if (embeddedBookText) blocks.push(`角色内嵌世界书:\n${embeddedBookText}`);

  return {
    description: description.trim(),
    personality: personality.trim(),
    scenario: scenario.trim(),
    embeddedBookText,
    combinedNarrative: blocks.join('\n\n'),
    info: {
      hasDescription: description.trim().length > 0,
      hasPersonality: personality.trim().length > 0,
      hasScenario: scenario.trim().length > 0,
      hasEmbeddedBook: embeddedEntries.length > 0,
    },
  };
}

export async function loadWorldbookRuntimeSection(worldbookIds: number[]) {
  if (worldbookIds.length === 0) {
    return {
      text: '',
      info: { count: 0, entryCount: 0 },
    };
  }

  const database = await getDb();
  const blocks: string[] = [];
  let totalEntries = 0;

  for (const worldbookId of worldbookIds) {
    const stmt = database.prepare('SELECT name, data FROM world_books WHERE id = ? LIMIT 1');
    stmt.bind([worldbookId]);

    if (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      const name = asString(row.name || `worldbook-${worldbookId}`);
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(asString(row.data || '{}')) as Record<string, unknown>;
      } catch {
        data = {};
      }

      const entries = Array.isArray(data.entries) ? data.entries : [];
      totalEntries += entries.length;

      const entryText = entries
        .map((entry) => {
          const e = asObject(entry) ?? {};
          const keys = Array.isArray(e.key) ? e.key.map((k) => asString(k)).filter(Boolean).join(', ') : '';
          const content = asString(e.content);
          if (!content.trim()) return '';
          return keys ? `- [${keys}] ${content}` : `- ${content}`;
        })
        .filter(Boolean)
        .join('\n');

      if (entryText.trim()) {
        blocks.push(`世界书(${name}):\n${entryText}`);
      }
    }

    stmt.free();
  }

  return {
    text: blocks.join('\n\n'),
    info: {
      count: worldbookIds.length,
      entryCount: totalEntries,
    },
  };
}

export async function getHistoryText(sessionId: number, limit = 40): Promise<string> {
  const database = await getDb();
  const stmt = database.prepare(
    'SELECT role, content FROM chat_messages WHERE chat_session_id = ? ORDER BY created_at ASC LIMIT ?'
  );
  stmt.bind([sessionId, limit]);

  const lines: string[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    const role = asString(row.role);
    const content = asString(row.content);
    lines.push(`[${role}] ${content}`);
  }
  stmt.free();

  return lines.join('\n');
}

export async function getLastUserMessageContent(sessionId: number): Promise<string> {
  const database = await getDb();
  const stmt = database.prepare(
    'SELECT content FROM chat_messages WHERE chat_session_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1'
  );
  stmt.bind([sessionId, 'user']);

  let content = '';
  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    content = asString(row.content);
  }
  stmt.free();
  return content;
}

export type RuntimeBuildResult = {
  promptText: string;
  presetInfo: {
    source: 'session' | 'default' | 'none';
    promptCount: number;
    /** 归一化后的 SIDE 预设（便于调试/扩展） */
    normalizedPreset: SIDEPresetData | null;
  };
  worldbookInfo: { count: number; entryCount: number };
  characterInfo: CharacterRuntimeParts['info'];
};

async function loadPresetData(session: SessionRow): Promise<{
  source: 'session' | 'default' | 'none';
  data: Record<string, unknown>;
}> {
  const database = await getDb();

  if (session.preset_id != null) {
    const stmt = database.prepare('SELECT data FROM presets WHERE id = ? LIMIT 1');
    stmt.bind([session.preset_id]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      stmt.free();
      return {
        source: 'session' as const,
        data: safeParseJsonObject(row.data),
      };
    }
    stmt.free();
  }

  const defaultStmt = database.prepare('SELECT data FROM presets WHERE is_default = 1 LIMIT 1');
  if (defaultStmt.step()) {
    const row = defaultStmt.getAsObject() as Record<string, unknown>;
    defaultStmt.free();
    return {
      source: 'default' as const,
      data: safeParseJsonObject(row.data),
    };
  }
  defaultStmt.free();

  return {
    source: 'none' as const,
    data: {},
  };
}

function applyPlaceholders(
  content: string,
  ctx: {
    character: CharacterRuntimeParts;
    worldbook: string;
    history: string;
    lastUser: string;
  }
): string {
  const map: Record<string, string> = {
    '{{char_description}}': ctx.character.description,
    '{{char_personality}}': ctx.character.personality,
    '{{scenario}}': ctx.character.scenario,
    '{{char_book}}': ctx.character.embeddedBookText,
    '{{embedded_book}}': ctx.character.embeddedBookText,
    '{{worldbook}}': ctx.worldbook,
    '{{chat_history}}': ctx.history,
    '{{user_input}}': ctx.lastUser,
    // 兼容旧占位：曾错误地合并为同一段 narrative
    '{{char}}': ctx.character.combinedNarrative,
  };

  let out = content;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(k).join(v);
  }
  return out;
}

function identifierFallbackContent(
  identifier: string,
  ctx: {
    character: CharacterRuntimeParts;
    worldbook: string;
    history: string;
  }
): string {
  switch (identifier) {
    case 'char_desc':
      return ctx.character.description;
    case 'char_personality':
      return ctx.character.personality;
    case 'scenario':
      return ctx.character.scenario;
    case 'world_info_before':
    case 'world_info_after':
      return ctx.worldbook;
    case 'chat_history':
      return ctx.history;
    case 'user_input':
      return '';
    default:
      return '';
  }
}

/**
 * 基础 runtime：preset（经 autoConvertPreset 归一化）+ 角色字段 + 世界书 + 历史占位。
 * 不接真实推理；输出用于占位校验与前端/日志展示。
 */
export async function buildRuntimeContext(session: SessionRow): Promise<RuntimeBuildResult> {
  const presetLoaded = await loadPresetData(session);
  const sidePreset = autoConvertPreset(presetLoaded.data);

  const character = await loadCharacterRuntimeParts(session.character_id);
  const worldbookSection = await loadWorldbookRuntimeSection(parseWorldbookIds(session.worldbook_ids));
  const historyText = await getHistoryText(session.id);
  const lastUser = await getLastUserMessageContent(session.id);

  const compiledBlocks = sidePreset.promptOrder
    .filter((b) => b.enabled)
    .map((block) => {
      let content = applyPlaceholders(block.content, {
        character,
        worldbook: worldbookSection.text,
        history: historyText,
        lastUser,
      });

      const fb = identifierFallbackContent(block.identifier, {
        character,
        worldbook: worldbookSection.text,
        history: historyText,
      });
      if (!content.trim() && fb.trim()) {
        content = fb;
      }

      const label = block.name || block.identifier;
      return `${label} (${block.identifier}):\n${content}`;
    })
    .filter((v) => v.trim().length > 0);

  const promptText = compiledBlocks.join('\n\n');

  return {
    promptText,
    presetInfo: {
      source: presetLoaded.source,
      promptCount: sidePreset.promptOrder.length,
      normalizedPreset: sidePreset,
    },
    worldbookInfo: worldbookSection.info,
    characterInfo: character.info,
  };
}
