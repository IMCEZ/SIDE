import { parseWorldBookFromObject } from '../../utils/worldBookParser';
import type {
  ImportNormalizedData,
  NormalizedCharacter,
  NormalizedWorldbook,
  NormalizedWorldbookEntry,
  StCharacterCardV3,
  StPromptPreset,
  StRegexRules,
  StWorldBookV1,
  StResourceKind,
} from './types';

export type NormalizedPresetPrompt = {
  identifier: string;
  name: string;
  system_prompt: boolean;
  marker: string;
  content: string;
  role: string;
  injection_position: number;
  injection_depth: number;
  forbid_overrides: boolean;
  enabled: boolean;
  // 保留更多原始字段以便后续扩展（不参与 SIDE 运行时）
  raw?: Record<string, unknown>;
};

export type NormalizedPresetPromptOrderItem = {
  character_id: number;
  order: Array<{
    identifier: string;
    enabled: boolean;
  }>;
};

export type NormalizedPreset = {
  // SIDE 运行时直接使用的 params
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
  // 标准化后的 SillyTavern prompt nodes
  prompts: NormalizedPresetPrompt[];
  // 标准化后的 SillyTavern prompt_order
  promptOrder: NormalizedPresetPromptOrderItem[];
  // 保留原始输入用于追溯
  rawData: Record<string, unknown>;
};

export type NormalizedRegexRule = {
  name: string;
  description?: string;
  regex: string;
  substitute: string | Record<string, string>;
  placement: 'input' | 'output' | 'both';
  enabled: boolean;
  order: number;
  raw?: Record<string, unknown>;
};

export type NormalizedRegexRuleset = {
  name: string;
  rules: NormalizedRegexRule[];
  rawData: Record<string, unknown>;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === '1') return true;
    if (s === '0') return false;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => asString(v))
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

function normalizeCharacterCardV3(card: StCharacterCardV3): ImportNormalizedData & { kind: 'character_card' } {
  const rawData = card as Record<string, unknown>;
  const data = isRecord(card.data) ? card.data : {};

  const name = asString(data.name) || asString(rawData.name);
  const description = asString(data.description);
  const personality = asString(data.personality);
  const scenario = asString(data.scenario);

  const firstMessage = asString(data.firstMessage) ?? asString(data.first_mes);
  const exampleMessages = asString(data.mes_example);
  const creatorNotes = asString(data.creator_notes);

  // character_book 必须保留：优先解析 entries，但仍保留 rawData.character_book
  const characterBookRaw = (data as any).character_book;
  let embeddedWorldbookData: unknown = characterBookRaw;
  if (characterBookRaw && isRecord(characterBookRaw)) {
    try {
      embeddedWorldbookData = parseWorldBookFromObject(characterBookRaw);
    } catch {
      embeddedWorldbookData = characterBookRaw;
    }
  }

  const alternate_greetings = asStringArray((data as any).alternate_greetings);
  const tags = asStringArray((data as any).tags);
  const extensions = isRecord((data as any).extensions) ? ((data as any).extensions as Record<string, unknown>) : undefined;

  // 统一 NormalizedCharacter：字段标准化，同时保留 rawData / embeddedWorldbookData
  const normalizedData: NormalizedCharacter = {
    name: name || 'Unnamed character',
    description,
    personality,
    scenario,

    firstMessage,
    exampleMessages,
    creatorNotes,

    alternate_greetings: alternate_greetings.length ? alternate_greetings : undefined,
    tags: tags.length ? tags : undefined,
    extensions,

    embeddedWorldbookData,
    rawData,
  };

  return {
    kind: 'character_card',
    spec: 'chara_card_v3',
    normalizedData,
  };
}

function normalizeWorldBookV1(book: StWorldBookV1): ImportNormalizedData & { kind: 'world_book' } {
  const raw = book as any;
  const data = isRecord(raw.data) ? raw.data : raw;

  const parsed = parseWorldBookFromObject(data);

  const scenario =
    typeof data.scenario === 'string' ? data.scenario : typeof raw.scenario === 'string' ? raw.scenario : undefined;

  const entries: NormalizedWorldbookEntry[] = parsed.entries.map((e: any) => ({
    uid: Number(e.uid ?? 0),
    key: Array.isArray(e.key) ? e.key : [],
    keysecondary: Array.isArray(e.keysecondary) ? e.keysecondary : [],
    content: typeof e.content === 'string' ? e.content : '',
    constant: Boolean(e.constant),
    selective: Boolean(e.selective),
    order: Number(e.insertion_order ?? 0),
    position: Number(e.position ?? 0),
    disable: e.enabled === false ? true : false,
  }));

  const normalizedData: NormalizedWorldbook = {
    name: parsed.name,
    description: parsed.description,
    scenario,
    entries,
    extensions: isRecord(data.extensions) ? (data.extensions as Record<string, unknown>) : parsed.extensions,
    rawData: raw,
  };

  return {
    kind: 'world_book',
    spec: 'world_book_v1',
    normalizedData,
  };
}

function normalizePromptPreset(preset: StPromptPreset): ImportNormalizedData & { kind: 'prompt_preset' } {
  const raw = preset as Record<string, unknown>;

  const promptsRaw = Array.isArray(raw.prompts) ? raw.prompts : [];
  const prompts: NormalizedPresetPrompt[] = promptsRaw.map((p: unknown, idx: number) => {
    const pr = isRecord(p) ? p : {};

    const role = asString(pr.role) ?? '';
    const systemPromptRaw = asBoolean(pr.system_prompt);
    const system_prompt = systemPromptRaw ?? (role === 'system');

    const identifierRaw = asString(pr.identifier);
    const identifier = identifierRaw && identifierRaw.trim().length ? identifierRaw.trim() : `prompt_${idx}`;

    const nameRaw = asString(pr.name);
    const name = (nameRaw && nameRaw.trim().length ? nameRaw.trim() : identifier) as string;

    const contentRaw = asString(pr.content);
    const content = contentRaw ?? '';

    const markerRaw = asString(pr.marker);
    const marker = markerRaw ?? '';

    const injection_position =
      asNumber(pr.injection_position) ??
      asNumber(pr.injectionPosition) ??
      0;

    const injection_depth =
      asNumber(pr.injection_depth) ??
      asNumber(pr.injectionDepth) ??
      0;

    const forbid_overrides = asBoolean(pr.forbid_overrides) ?? false;

    const enabledRaw = asBoolean(pr.enabled);
    const enabled = enabledRaw === undefined ? pr.enabled !== false : enabledRaw;

    return {
      identifier,
      name,
      system_prompt,
      marker,
      content,
      role,
      injection_position,
      injection_depth,
      forbid_overrides,
      enabled: Boolean(enabled),
      raw: pr,
    };
  });

  // prompt_order: 可能是 flat: [{identifier, enabled}]，也可能是 nested: [{character_id, order:[...]}]
  const promptOrderRaw = Array.isArray(raw.prompt_order) ? raw.prompt_order : Array.isArray(raw.promptOrder) ? raw.promptOrder : undefined;
  let promptOrder: NormalizedPresetPromptOrderItem[] = [];

  if (promptOrderRaw) {
    const anyNested = (promptOrderRaw as unknown[]).some((e) => isRecord(e) && Array.isArray((e as any).order));

    if (anyNested) {
      promptOrder = (promptOrderRaw as unknown[]).map((entry: unknown) => {
        const e = isRecord(entry) ? entry : {};
        const character_id = asNumber((e as any).character_id) ?? 0;

        const orderRawArr = Array.isArray((e as any).order) ? (e as any).order : [];
        const order = orderRawArr
          .map((o: unknown, idx: number) => {
            const ob = isRecord(o) ? o : {};
            const identifierRaw = asString((ob as any).identifier);
            const identifier = identifierRaw && identifierRaw.trim().length ? identifierRaw.trim() : `order_${idx}`;
            const enabled = asBoolean((ob as any).enabled) ?? ((ob as any).enabled !== false);
            return { identifier, enabled: Boolean(enabled) };
          })
          .filter((x: { identifier: string }) => x.identifier.trim().length > 0);

        return { character_id, order };
      });
    } else {
      // flat
      const order = (promptOrderRaw as unknown[]).map((entry: unknown, idx: number) => {
        const e = isRecord(entry) ? entry : {};
        const identifierRaw = asString((e as any).identifier);
        const identifier = identifierRaw && identifierRaw.trim().length ? identifierRaw.trim() : `order_${idx}`;
        const enabled = asBoolean((e as any).enabled) ?? ((e as any).enabled !== false);
        return { identifier, enabled: Boolean(enabled) };
      });

      promptOrder = [{ character_id: 0, order }];
    }
  }

  const params = {
    temperature: asNumber(raw.temperature) ?? 0.7,
    maxTokens:
      asNumber(raw.max_tokens) ??
      asNumber(raw.maxTokens) ??
      asNumber((raw as any).openai_max_tokens) ??
      asNumber((raw as any).max_length) ??
      2048,
    topP: asNumber((raw as any).top_p) ?? asNumber((raw as any).topP) ?? 0.9,
    topK: asNumber((raw as any).top_k) ?? asNumber((raw as any).topK) ?? 0,
    frequencyPenalty:
      asNumber((raw as any).frequency_penalty) ??
      asNumber((raw as any).frequencyPenalty) ??
      0,
    presencePenalty:
      asNumber((raw as any).presence_penalty) ??
      asNumber((raw as any).presencePenalty) ??
      0,
    repetitionPenalty:
      asNumber((raw as any).repetition_penalty) ??
      asNumber((raw as any).repetitionPenalty) ??
      1,
    seed: asNumber(raw.seed) ?? -1,
  };

  const normalizedPreset: NormalizedPreset = {
    params,
    prompts,
    promptOrder,
    rawData: raw,
  };

  return {
    kind: 'prompt_preset',
    normalizedData: normalizedPreset,
  };
}

function normalizeRegexRules(rules: StRegexRules): ImportNormalizedData & { kind: 'regex_rules' } {
  if (!Array.isArray(rules)) {
    throw new Error('Invalid regex rules: expected an array');
  }

  const normalizedRules: NormalizedRegexRule[] = rules.map((r: unknown, idx: number) => {
    const rule = isRecord(r) ? r : {};

    const name = asString((rule as any).name) ?? `regex_rule_${idx}`;
    const description = asString((rule as any).description);
    const regex = asString((rule as any).regex) ?? '';
    const placementRaw = asString((rule as any).placement);
    const placement: NormalizedRegexRule['placement'] = placementRaw === 'input' || placementRaw === 'output' || placementRaw === 'both' ? placementRaw : 'both';

    const enabled = asBoolean((rule as any).enabled);
    const enabledFinal = enabled === undefined ? (rule as any).enabled !== false : enabled;

    const orderNum = asNumber((rule as any).order);
    const orderFinal = orderNum === undefined ? idx : orderNum;

    const substituteRaw = (rule as any).substitute;
    let substitute: NormalizedRegexRule['substitute'];
    if (typeof substituteRaw === 'string') {
      substitute = substituteRaw;
    } else if (isRecord(substituteRaw)) {
      const map: Record<string, string> = {};
      for (const [k, v] of Object.entries(substituteRaw)) {
        if (typeof k !== 'string' || k.trim().length === 0) continue;
        if (typeof v !== 'string' || v.trim().length === 0) continue;
        map[k] = v;
      }
      substitute = map;
    } else {
      substitute = '';
    }

    return {
      name,
      description: description && description.trim().length ? description : undefined,
      regex,
      substitute,
      placement,
      enabled: Boolean(enabledFinal),
      order: Number(orderFinal),
      raw: rule,
    };
  });

  const rulesetName = normalizedRules[0]?.name ?? 'Imported Regex Ruleset';

  const normalizedRuleset: NormalizedRegexRuleset = {
    name: rulesetName,
    rules: normalizedRules.sort((a, b) => a.order - b.order),
    rawData: { rules },
  };

  return {
    kind: 'regex_rules',
    normalizedData: normalizedRuleset,
  };
}

export function normalizeStResourceKind(
  kind: StResourceKind,
  input: unknown
): { ok: true; value: ImportNormalizedData } | { ok: false; errors: string[] } {
  try {
    switch (kind) {
      case 'character_card': {
        if (!input || typeof input !== 'object') return { ok: false, errors: ['Invalid character card'] };
        return { ok: true, value: normalizeCharacterCardV3(input as StCharacterCardV3) };
      }
      case 'world_book': {
        if (!input || typeof input !== 'object') return { ok: false, errors: ['Invalid world book'] };
        return { ok: true, value: normalizeWorldBookV1(input as StWorldBookV1) };
      }
      case 'prompt_preset': {
        if (!input || typeof input !== 'object') return { ok: false, errors: ['Invalid prompt preset'] };
        return { ok: true, value: normalizePromptPreset(input as StPromptPreset) };
      }
      case 'regex_rules': {
        return { ok: true, value: normalizeRegexRules(input as StRegexRules) };
      }
      default:
        return { ok: false, errors: ['Unsupported kind'] };
    }
  } catch (e: any) {
    return { ok: false, errors: [e?.message ?? 'Normalization failed'] };
  }
}

