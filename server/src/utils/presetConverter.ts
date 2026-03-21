/**
 * SillyTavern 预设格式 ↔ SIDE 预设格式 转换器
 *
 * ST 格式特征:
 * - 顶层有 temperature / frequency_penalty / presence_penalty / top_p 等参数
 * - 有 prompts 数组 (每个元素: { name, system_prompt, role, content, identifier })
 * - 有 prompt_order 数组 (每个元素: { identifier, enabled })
 * - 可能有 chat_completion_source / oai_model 等字段
 *
 * SIDE 格式:
 * - params: { temperature, maxTokens, topP, topK, frequencyPenalty, presencePenalty, repetitionPenalty, seed }
 * - promptOrder: [{ identifier, name, content, enabled, system, order }]
 */

export interface SIDEPromptBlock {
  identifier: string;
  name: string;
  content: string;
  enabled: boolean;
  system: boolean;
  order: number;
}

export interface SIDEPresetData {
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
  promptOrder: SIDEPromptBlock[];
}

export interface STPrompt {
  name?: string;
  system_prompt?: boolean;
  role?: string;
  content?: string;
  identifier?: string;
  injection_position?: number;
  injection_depth?: number;
  enabled?: boolean;
}

export interface STPromptOrderEntry {
  identifier?: string;
  enabled?: boolean;
}

/**
 * 检测 JSON 数据是否为 SillyTavern 预设格式
 */
export function isSillyTavernPreset(data: any): boolean {
  if (!data || typeof data !== 'object') return false;

  // ST 预设通常有以下特征之一:
  // 1. 有 prompts 数组
  // 2. 有 prompt_order 数组
  // 3. 有 chat_completion_source 字段
  // 4. 顶层直接有 temperature 且没有 params 对象
  const hasPrompts = Array.isArray(data.prompts);
  const hasPromptOrder = Array.isArray(data.prompt_order);
  const hasChatSource = typeof data.chat_completion_source === 'string';
  const hasTopLevelTemp = typeof data.temperature === 'number' && !data.params;

  return hasPrompts || hasPromptOrder || hasChatSource || hasTopLevelTemp;
}

/**
 * 检测 JSON 数据是否已经是 SIDE 内部格式
 */
export function isSIDEPreset(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  return (
    data.params &&
    typeof data.params === 'object' &&
    typeof data.params.temperature === 'number' &&
    Array.isArray(data.promptOrder)
  );
}

/**
 * 将 SillyTavern 预设格式转换为 SIDE 格式
 */
export function convertSTPresetToSIDE(stData: any): SIDEPresetData {
  // 1. 提取生成参数
  const params: SIDEPresetData['params'] = {
    temperature: safeNumber(stData.temperature, 0.7),
    maxTokens: safeNumber(
      stData.max_tokens ?? stData.openai_max_tokens ?? stData.max_length ?? stData.maxTokens,
      2048
    ),
    topP: safeNumber(stData.top_p ?? stData.topP, 0.9),
    topK: safeNumber(stData.top_k ?? stData.topK, 0),
    frequencyPenalty: safeNumber(stData.frequency_penalty ?? stData.frequencyPenalty, 0),
    presencePenalty: safeNumber(stData.presence_penalty ?? stData.presencePenalty, 0),
    repetitionPenalty: safeNumber(stData.repetition_penalty ?? stData.repetitionPenalty, 1),
    seed: safeNumber(stData.seed, -1),
  };

  // 2. 提取 prompt blocks
  const promptOrder: SIDEPromptBlock[] = [];

  if (Array.isArray(stData.prompts)) {
    // 获取 prompt_order 来确定启用状态和顺序
    const orderMap = new Map<string, { enabled: boolean; index: number }>();
    if (Array.isArray(stData.prompt_order)) {
      // ST 的 prompt_order 可能是 [{ identifier, enabled }]
      // 也可能是 [{ character_id: X, order: [{ identifier, enabled }] }]
      let orderList: STPromptOrderEntry[] = [];

      if (stData.prompt_order.length > 0) {
        const first = stData.prompt_order[0];
        if (first && Array.isArray(first.order)) {
          // 嵌套格式: [{ character_id, order: [...] }]
          orderList = first.order;
        } else {
          // 扁平格式: [{ identifier, enabled }]
          orderList = stData.prompt_order;
        }
      }

      orderList.forEach((entry: STPromptOrderEntry, index: number) => {
        if (entry.identifier) {
          orderMap.set(entry.identifier, {
            enabled: entry.enabled !== false,
            index,
          });
        }
      });
    }

    stData.prompts.forEach((prompt: STPrompt, fallbackIndex: number) => {
      const identifier = prompt.identifier || `prompt_${fallbackIndex}`;
      const orderEntry = orderMap.get(identifier);

      promptOrder.push({
        identifier,
        name: prompt.name || identifier,
        content: prompt.content || '',
        enabled: orderEntry ? orderEntry.enabled : prompt.enabled !== false,
        system: prompt.system_prompt === true || prompt.role === 'system',
        order: orderEntry ? orderEntry.index : fallbackIndex,
      });
    });

    // 按 order 排序
    promptOrder.sort((a, b) => a.order - b.order);
  }

  // 3. 如果没有解析到任何 prompt blocks，使用默认结构
  if (promptOrder.length === 0) {
    promptOrder.push(
      { identifier: 'main_prompt', name: '主提示词', content: '', enabled: true, system: true, order: 0 },
      { identifier: 'world_info_before', name: '世界书（前）', content: '', enabled: true, system: false, order: 1 },
      { identifier: 'char_desc', name: '角色描述', content: '', enabled: true, system: false, order: 2 },
      { identifier: 'char_personality', name: '角色性格', content: '', enabled: true, system: false, order: 3 },
      { identifier: 'world_info_after', name: '世界书（后）', content: '', enabled: true, system: false, order: 4 },
      { identifier: 'chat_history', name: '对话历史', content: '', enabled: true, system: false, order: 5 },
      { identifier: 'user_input', name: '用户输入', content: '', enabled: true, system: false, order: 6 }
    );
  }

  return { params, promptOrder };
}

/**
 * 智能转换: 自动检测格式并返回 SIDE 格式
 * - 如果已经是 SIDE 格式，原样返回
 * - 如果是 ST 格式，转换后返回
 * - 如果无法识别，包裹在默认结构中返回
 */
export function autoConvertPreset(data: any): SIDEPresetData {
  if (isSIDEPreset(data)) {
    return data as SIDEPresetData;
  }

  if (isSillyTavernPreset(data)) {
    return convertSTPresetToSIDE(data);
  }

  // 无法识别的格式，尝试提取可能存在的参数
  return {
    params: {
      temperature: safeNumber(data?.temperature, 0.7),
      maxTokens: safeNumber(data?.max_tokens ?? data?.maxTokens, 2048),
      topP: safeNumber(data?.top_p ?? data?.topP, 0.9),
      topK: safeNumber(data?.top_k ?? data?.topK, 0),
      frequencyPenalty: safeNumber(data?.frequency_penalty ?? data?.frequencyPenalty, 0),
      presencePenalty: safeNumber(data?.presence_penalty ?? data?.presencePenalty, 0),
      repetitionPenalty: safeNumber(data?.repetition_penalty ?? data?.repetitionPenalty, 1),
      seed: safeNumber(data?.seed, -1),
    },
    promptOrder: [
      { identifier: 'main_prompt', name: '主提示词', content: '', enabled: true, system: true, order: 0 },
      { identifier: 'world_info_before', name: '世界书（前）', content: '', enabled: true, system: false, order: 1 },
      { identifier: 'char_desc', name: '角色描述', content: '', enabled: true, system: false, order: 2 },
      { identifier: 'char_personality', name: '角色性格', content: '', enabled: true, system: false, order: 3 },
      { identifier: 'world_info_after', name: '世界书（后）', content: '', enabled: true, system: false, order: 4 },
      { identifier: 'chat_history', name: '对话历史', content: '', enabled: true, system: false, order: 5 },
      { identifier: 'user_input', name: '用户输入', content: '', enabled: true, system: false, order: 6 },
    ],
  };
}

function safeNumber(val: unknown, fallback: number): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}
