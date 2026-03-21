// 应用常量定义

export const APP_NAME = 'SIDE'
export const APP_VERSION = '1.0.0'
export const APP_DESCRIPTION = '沉浸式 AI 对话平台'

export const STORAGE_KEYS = {
  TOKEN: 'side_token',
  THEME: 'side_theme',
  SETTINGS: 'side_settings',
} as const

export const API_CONFIG = {
  BASE_URL: '/api/v1',
  TIMEOUT: 30000,
  RETRY_COUNT: 1,
} as const

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const

export const DEFAULT_MODEL_PARAMS = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  repetitionPenalty: 1,
  seed: -1,
} as const

export const DEFAULT_PROMPT_BLOCKS = [
  { identifier: 'main_prompt', name: '主提示词', content: '你是一个有帮助的AI助手。', enabled: true, system: true, order: 0 },
  { identifier: 'world_info_before', name: '世界书（前）', content: '', enabled: true, system: false, order: 1 },
  { identifier: 'char_desc', name: '角色描述', content: '', enabled: true, system: false, order: 2 },
  { identifier: 'char_personality', name: '角色性格', content: '', enabled: true, system: false, order: 3 },
  { identifier: 'world_info_after', name: '世界书（后）', content: '', enabled: true, system: false, order: 4 },
  { identifier: 'chat_history', name: '对话历史', content: '', enabled: true, system: false, order: 5 },
  { identifier: 'user_input', name: '用户输入', content: '', enabled: true, system: false, order: 6 },
] as const

export const ROUTES = {
  LOGIN: '/login',
  HOME: '/',
  CHARACTERS: '/characters',
  CHAT: '/chat',
  WORLDS: '/worlds',
  PRESETS: '/presets',
  REGEX: '/regex',
  SETTINGS: '/settings',
} as const

/** 与后端 error_logs.code / errorCategories 对齐的分类键（供前端展示与扩展） */
export const ERROR_CATEGORIES = {
  validation: 'validation',
  import: 'import',
  api_connection: 'api_connection',
  model_fetch: 'model_fetch',
  chat_runtime: 'chat_runtime',
  internal: 'internal',
} as const

export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  UNAUTHORIZED: '登录已过期，请重新登录',
  FORBIDDEN: '没有权限执行此操作',
  NOT_FOUND: '请求的资源不存在',
  SERVER_ERROR: '服务器错误，请稍后重试',
  UNKNOWN_ERROR: '发生未知错误',
} as const
