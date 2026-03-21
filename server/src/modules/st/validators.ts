import { errorCodes, type ErrorCode } from '../../core/errors/errorCodes';
import type { ApiWarning } from '../../core/http/apiResponse';
import type {
  StCharacterCardV3,
  StPromptPreset,
  StRegexRules,
  StWorldBookV1,
  StResourceKind,
} from './types';
import { parseWorldBookFromObject } from '../../utils/worldBookParser';

export type StValidationSuccess<T> = {
  ok: true;
  value: T;
  warnings?: ApiWarning[];
};

export type StValidationFailure = {
  ok: false;
  errors: string[];
  code: ErrorCode;
  warnings?: ApiWarning[];
};

export type StValidationResult<T> = StValidationSuccess<T> | StValidationFailure;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function detectKind(input: unknown): StResourceKind | null {
  if (Array.isArray(input)) return 'regex_rules';
  if (!isRecord(input)) return null;

  const spec = (input as any).spec;
  if (spec === 'chara_card_v3') return 'character_card';
  if (spec === 'world_book_v1') return 'world_book';
  if (Array.isArray((input as any).prompts) || Array.isArray((input as any).prompt_order) || spec === 'prompt_preset') {
    return 'prompt_preset';
  }

  return null;
}

export function validateStResourceKind(input: unknown): StValidationResult<{ kind: StResourceKind }> {
  const kind = detectKind(input);
  if (!kind) {
    return {
      ok: false,
      errors: ['Unsupported ST resource kind'],
      code: errorCodes.ST_VALIDATION_FAILED,
    };
  }
  return { ok: true, value: { kind } };
}

export function validateCharacterCardV3(input: unknown): StValidationResult<StCharacterCardV3> {
  if (!isRecord(input)) {
    return { ok: false, errors: ['Character card must be an object'], code: errorCodes.ST_VALIDATION_FAILED };
  }

  const raw = input as any;
  const spec = raw.spec;

  // 宽松策略：允许 spec 缺失，但如果 spec 存在且不匹配则失败
  if (spec !== undefined && spec !== 'chara_card_v3') {
    return { ok: false, errors: [`Unsupported spec: ${String(spec)}`], code: errorCodes.ST_VALIDATION_FAILED };
  }

  if (!raw.data || !isRecord(raw.data)) {
    return { ok: false, errors: ['Character card missing data object'], code: errorCodes.ST_VALIDATION_FAILED };
  }

  const data = raw.data as Record<string, unknown>;

  const name =
    typeof data.name === 'string' && data.name.trim()
      ? data.name.trim()
      : typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : undefined;

  // data.name 缺失且无法推断：错误
  if (!name) {
    return {
      ok: false,
      errors: ['Character card missing data.name and cannot infer name'],
      code: errorCodes.ST_VALIDATION_FAILED,
    };
  }

  const warnings: ApiWarning[] = [];

  // first message 缺失：warning
  const firstMessage =
    typeof data.firstMessage === 'string' && data.firstMessage.trim()
      ? data.firstMessage
      : typeof data.first_mes === 'string' && data.first_mes.trim()
        ? data.first_mes
        : ''
  if (!firstMessage) {
    warnings.push({ message: 'Missing first message (data.firstMessage / data.first_mes)' });
  }

  // creator notes 缺失：warning
  if (typeof data.creator_notes !== 'string' || !data.creator_notes.trim()) {
    warnings.push({ message: 'Missing creator notes (data.creator_notes)' });
  }

  // character_book 为空：warning
  const characterBook = data.character_book;
  const isBookEmpty = (() => {
    if (characterBook == null) return true;
    if (Array.isArray(characterBook)) return characterBook.length === 0;
    if (isRecord(characterBook)) {
      // 如果存在 entries 字段，则优先判断 entries 是否为空
      if ('entries' in characterBook) {
        const entries = (characterBook as any).entries as unknown;
        if (Array.isArray(entries)) return entries.length === 0;
        if (isRecord(entries)) return Object.keys(entries).length === 0;
        return entries == null;
      }
      return Object.keys(characterBook).length === 0;
    }
    return false;
  })();
  if (isBookEmpty) {
    warnings.push({ message: 'character_book is empty' });
  }

  // unknown extensions：只要 extensions 存在且非空就按“未知”处理（骨架阶段）
  const extensions = data.extensions;
  if (extensions && isRecord(extensions) && Object.keys(extensions).length > 0) {
    warnings.push({ message: 'Unknown extensions present (data.extensions)' });
  }

  const value: StCharacterCardV3 = {
    ...(input as any),
    spec: raw.spec ?? 'chara_card_v3',
    data: data,
  };

  return {
    ok: true,
    value,
    warnings: warnings.length ? warnings : undefined,
  };
}

export function validateWorldBookV1(input: unknown): StValidationResult<StWorldBookV1> {
  if (!isRecord(input)) {
    return { ok: false, errors: ['World book must be an object'], code: errorCodes.ST_VALIDATION_FAILED };
  }

  const raw = input as any;
  const spec = raw.spec;
  if (spec && spec !== 'world_book_v1') {
    return { ok: false, errors: [`Unsupported spec: ${String(spec)}`], code: errorCodes.ST_VALIDATION_FAILED };
  }

  const data = isRecord(raw.data) ? raw.data : raw;

  const name = (data?.name ?? raw?.name) as unknown;
  if (typeof name !== 'string' || !name.trim()) {
    return { ok: false, errors: ['World book missing data.name'], code: errorCodes.ST_VALIDATION_FAILED };
  }

  // entries 完全缺失 -> error
  if (!('entries' in data)) {
    return { ok: false, errors: ['World book missing data.entries'], code: errorCodes.ST_VALIDATION_FAILED };
  }

  const entriesSource = data.entries;
  const parsed = parseWorldBookFromObject({ ...data, entries: entriesSource });

  const warnings: ApiWarning[] = [];

  // entries 为空 -> warning
  if (parsed.entries.length === 0) {
    warnings.push({ message: 'entries is empty' });
  }

  // extensions 存在未知字段 -> warning
  if (isRecord(data.extensions) && Object.keys(data.extensions).length > 0) {
    warnings.push({ message: 'Unknown extensions fields present (data.extensions)' });
  }

  // 某些 entry 缺少 secondary keys -> warning
  parsed.entries.forEach((e: any, idx: number) => {
    const sec = Array.isArray(e.keysecondary) ? e.keysecondary : [];
    if (sec.length === 0) {
      warnings.push({ message: `Entry missing secondary keys at index ${idx}` });
    }
  });

  const value: StWorldBookV1 = raw;
  return { ok: true, value, warnings: warnings.length ? warnings : undefined };
}

export function validatePromptPreset(input: unknown): StValidationResult<StPromptPreset> {
  if (!isRecord(input)) {
    return { ok: false, errors: ['Prompt preset must be an object'], code: errorCodes.ST_VALIDATION_FAILED };
  }

  const raw = input as Record<string, unknown>;
  const warnings: ApiWarning[] = [];

  const allowedTopLevelFields = new Set<string>([
    // ST prompt preset 顶层常见采样参数
    'temperature',
    'max_tokens',
    'maxTokens',
    'top_p',
    'topP',
    'top_k',
    'topK',
    'frequency_penalty',
    'frequencyPenalty',
    'presence_penalty',
    'presencePenalty',
    'repetition_penalty',
    'repetitionPenalty',
    'seed',
    'max_length',
    'openai_max_tokens',

    // 顶层格式/提示字段（本步要求重点兼容）
    'impersonation_prompt',
    'new_chat_prompt',
    'new_group_chat_prompt',
    'new_example_chat_prompt',
    'continue_nudge_prompt',
    'scenario_format',
    'personality_format',
    'group_nudge_prompt',
    'wi_format',

    // 关键容器字段
    'prompts',
    'prompt_order',
    'promptOrder',

    // 其它常见 ST preset 字段：宽松允许出现但不强校验
    'chat_completion_source',
    'oai_model',
    'openai_model',
    'name',
    'description',
  ]);

  const hasPrompts = Array.isArray(raw.prompts);
  const hasOrder = Array.isArray(raw.prompt_order) || Array.isArray(raw.promptOrder);
  const hasRequiredSignals =
    hasPrompts ||
    hasOrder ||
    typeof raw.temperature !== 'undefined' ||
    typeof raw.max_tokens !== 'undefined' ||
    typeof raw.maxTokens !== 'undefined' ||
    typeof raw.impersonation_prompt !== 'undefined' ||
    typeof raw.new_chat_prompt !== 'undefined' ||
    typeof raw.continue_nudge_prompt !== 'undefined' ||
    typeof raw.scenario_format !== 'undefined' ||
    typeof raw.personality_format !== 'undefined' ||
    typeof raw.group_nudge_prompt !== 'undefined' ||
    typeof raw.wi_format !== 'undefined';

  if (!hasRequiredSignals) {
    return {
      ok: false,
      errors: ['Unsupported prompt preset format'],
      code: errorCodes.ST_VALIDATION_FAILED,
    };
  }

  const unknownTopLevel = Object.keys(raw).filter((k) => !allowedTopLevelFields.has(k));
  if (unknownTopLevel.length) {
    // 限制长度，避免超长 warning
    warnings.push({ message: `Unknown top-level fields: ${unknownTopLevel.slice(0, 20).join(', ')}` });
  }

  // -------- prompts[] --------
  let promptIdentifiers = new Set<string>();
  const promptsArray = raw.prompts;
  if (promptsArray !== undefined) {
    if (!Array.isArray(promptsArray)) {
      return {
        ok: false,
        errors: ['prompt preset "prompts" must be an array'],
        code: errorCodes.ST_VALIDATION_FAILED,
      };
    }

    (promptsArray as unknown[]).forEach((p, idx) => {
      if (!isRecord(p)) {
        return;
      }
      const identifierRaw = (p as any).identifier;
      const identifier =
        typeof identifierRaw === 'string' && identifierRaw.trim().length > 0 ? identifierRaw.trim() : `prompt_${idx}`;
      promptIdentifiers.add(identifier);

      const content = (p as any).content;
      if (typeof content !== 'string' || !content.trim()) {
        warnings.push({ message: `Prompt node missing content (index ${idx})` });
      }
    });
  } else {
    promptIdentifiers = new Set();
  }

  // -------- prompt_order[] --------
  const orderRaw = Array.isArray(raw.prompt_order) ? raw.prompt_order : raw.promptOrder;
  if (orderRaw !== undefined) {
    if (!Array.isArray(orderRaw)) {
      return {
        ok: false,
        errors: ['prompt preset "prompt_order" must be an array'],
        code: errorCodes.ST_VALIDATION_FAILED,
      };
    }

    const extractIdentifiersFromOrder = (entry: unknown): string[] => {
      if (!isRecord(entry)) return [];
      const e = entry as any;

      // nested: { character_id, order: [{ identifier, enabled }] }
      if (Array.isArray(e.order)) {
        return (e.order as unknown[]).flatMap((o) => {
          if (!isRecord(o)) return [];
          const id = (o as any).identifier;
          return typeof id === 'string' && id.trim() ? [id.trim()] : [];
        });
      }

      // flat: { identifier, enabled }
      const id = e.identifier;
      if (typeof id === 'string' && id.trim()) return [id.trim()];
      return [];
    };

    const referenced = new Set<string>();
    (orderRaw as unknown[]).forEach((entry) => extractIdentifiersFromOrder(entry).forEach((id) => referenced.add(id)));

    for (const id of referenced) {
      if (!promptIdentifiers.has(id)) {
        warnings.push({ message: `prompt_order references undefined identifier: ${id}` });
      }
    }
  }

  return { ok: true, value: input as StPromptPreset, warnings: warnings.length ? warnings : undefined };
}

export function validateRegexRules(input: unknown): StValidationResult<StRegexRules> {
  if (!Array.isArray(input)) {
    return { ok: false, errors: ['Regex rules must be an array'], code: errorCodes.ST_VALIDATION_FAILED };
  }

  const rawRules = input as unknown[];

  const warnings: ApiWarning[] = [];
  const errors: string[] = [];

  const asString = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return undefined;
  };

  const asBoolean = (v: unknown): boolean | undefined => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s === 'true' || s === '1') return true;
      if (s === 'false' || s === '0') return false;
    }
    return undefined;
  };

  const asNumber = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return undefined;
  };

  const allowedPlacement = new Set<string>(['input', 'output', 'both']);

  rawRules.forEach((r, idx) => {
    if (!isRecord(r)) {
      errors.push(`Rule at index ${idx} must be an object`);
      return;
    }

    const name = asString((r as any).name);
    const description = asString((r as any).description);
    const regexStr = asString((r as any).regex);
    const substitute = (r as any).substitute;
    const placementRaw = asString((r as any).placement);
    const enabled = asBoolean((r as any).enabled);
    const order = asNumber((r as any).order);

    // name/description/regex/placement 关键字段
    if (!name || !name.trim()) {
      warnings.push({ message: `Rule at index ${idx} missing name` });
    }

    if (!description || !description.trim()) {
      warnings.push({ message: `Rule at index ${idx} missing description` });
    }

    if (!order && order !== 0) {
      warnings.push({ message: `Rule at index ${idx} missing order` });
    }

    if (!placementRaw || !allowedPlacement.has(placementRaw)) {
      errors.push(`Rule at index ${idx} has invalid placement`);
    }

    if (!regexStr || !regexStr.trim()) {
      errors.push(`Rule at index ${idx} missing regex`);
    } else {
      // 安全构造 RegExp 验证 regex 是否有效（不执行替换，只编译）
      try {
        // eslint-disable-next-line no-new
        new RegExp(regexStr);
      } catch (e: any) {
        errors.push(`Rule at index ${idx} regex cannot compile: ${e?.message ?? String(e)}`);
      }
    }

    // substitute：string 或 mapping object
    if (typeof substitute === 'string') {
      // ok
    } else if (isRecord(substitute)) {
      const entries = Object.entries(substitute as Record<string, unknown>);
      const validPairs = entries.filter(([k, v]) => {
        if (typeof k !== 'string' || !k.trim()) return false;
        if (typeof v !== 'string') return false;
        if (!v.trim()) return false;
        return true;
      });

      if (validPairs.length === 0) {
        warnings.push({ message: `Rule at index ${idx} substitute mapping object is incomplete` });
      } else if (validPairs.length !== entries.length) {
        warnings.push({ message: `Rule at index ${idx} substitute mapping object has incomplete keys/values` });
      }
    } else if (substitute === undefined) {
      warnings.push({ message: `Rule at index ${idx} missing substitute` });
    } else {
      errors.push(`Rule at index ${idx} has invalid substitute type`);
    }

    // enabled/order 目前不作为硬错误：normalizer 会提供默认值
    void enabled;
  });

  if (errors.length) {
    return { ok: false, errors, code: errorCodes.ST_VALIDATION_FAILED, warnings: warnings.length ? warnings : undefined };
  }

  return { ok: true, value: input as StRegexRules, warnings: warnings.length ? warnings : undefined };
}

