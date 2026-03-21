import type { ApiWarning } from '../../core/http/apiResponse';

/**
 * 四类 ST 资源兼容原则（本步只做骨架）
 * - Character Card：支持 `chara_card_v3`
 * - World Book：支持 `world_book_v1`
 * - Preset：ST Prompt Preset
 * - Regex Rules：规则数组资源（此处先统一成“规则块数组”过渡）
 *
 * 说明：
 * - ST 原始 JSON 不直接当内部业务模型；
 * - 任何导入结果都必须能返回 success / warnings / error；
 * - 本步不做完整导入器，只提供类型与最小实现骨架。
 */

export type StResourceKind = 'character_card' | 'world_book' | 'prompt_preset' | 'regex_rules';

export type StCharacterCardSpec = 'chara_card_v3';

// Character Card（v3）形状尽量宽松：本步不要求完整字段对齐
export type StCharacterCardV3 = {
  spec: StCharacterCardSpec;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

export type StWorldBookSpec = 'world_book_v1';

export type StWorldBookV1 = {
  spec?: StWorldBookSpec;
  name?: string;
  description?: string;
  entries?: unknown;
  data?: unknown;
  [key: string]: unknown;
};

// ST Prompt Preset：顶层参数 + prompts/prompt_order 等字段（宽松）
export type StPromptPreset = {
  // 常见参数（不强校验，本步只是骨架）
  temperature?: unknown;
  max_tokens?: unknown;
  maxTokens?: unknown;
  top_p?: unknown;
  topP?: unknown;
  prompts?: unknown;
  prompt_order?: unknown;
  promptOrder?: unknown;
  [key: string]: unknown;
};

// Regex rules：规则数组资源
export type StRegexRules = unknown[] | Record<string, unknown>;

export type NormalizedCharacter = {
  // SIDE 内部优先使用的基本字段（供聊天系统读取描述）
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;

  // 标准化字段映射
  firstMessage?: string;
  exampleMessages?: string;
  creatorNotes?: string;

  alternate_greetings?: string[];
  tags?: string[];
  extensions?: Record<string, unknown>;

  // 角色卡内嵌世界书：用于保留 character_book.entries 不丢失
  embeddedWorldbookData?: unknown;

  // 保留原始输入（用于尽可能不丢字段）
  rawData: Record<string, unknown>;
};

export type NormalizedWorldbookEntry = {
  uid: number;
  key: string[];
  keysecondary: string[];
  content: string;
  constant: boolean;
  selective: boolean;
  order: number;
  position: number;
  // requirement: disable
  disable: boolean;
};

export type NormalizedWorldbook = {
  name: string;
  description?: string;
  scenario?: string;
  entries: NormalizedWorldbookEntry[];
  extensions?: Record<string, unknown>;
  rawData: Record<string, unknown>;
};

export type ImportNormalizedData =
  | {
      kind: 'character_card';
      spec: StCharacterCardSpec;
      normalizedData: NormalizedCharacter;
      warnings?: ApiWarning[];
    }
  | {
      kind: 'world_book';
      spec?: StWorldBookSpec;
      normalizedData: NormalizedWorldbook;
      warnings?: ApiWarning[];
    }
  | {
      kind: 'prompt_preset';
      normalizedData: Record<string, unknown>;
      warnings?: ApiWarning[];
    }
  | {
      kind: 'regex_rules';
      normalizedData: Record<string, unknown>;
      warnings?: ApiWarning[];
    };

