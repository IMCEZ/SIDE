export const errorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL',
  UNKNOWN: 'UNKNOWN',

  // ST 兼容层/导入层（本步只做骨架，不要求完整实现）
  ST_VALIDATION_FAILED: 'ST_VALIDATION_FAILED',
  ST_NORMALIZATION_FAILED: 'ST_NORMALIZATION_FAILED',
  IMPORT_NOT_IMPLEMENTED: 'IMPORT_NOT_IMPLEMENTED',
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];

export const errorCategories = {
  validation: 'validation',
  import: 'import',
  api_connection: 'api_connection',
  model_fetch: 'model_fetch',
  chat_runtime: 'chat_runtime',
  internal: 'internal',
} as const;

export type ErrorCategory = (typeof errorCategories)[keyof typeof errorCategories];

/** 错误分类（写入 error_logs.code）与典型错误码/场景的映射 */
export const errorCategoryMap: Record<
  ErrorCategory,
  { description: string; examples: string[] }
> = {
  validation: {
    description: '请求参数或业务校验失败',
    examples: ['INVALID_ID', 'VALIDATION_ERROR', 'ST_VALIDATION_FAILED'],
  },
  import: {
    description: '资源导入/归一化失败',
    examples: ['IMPORT_NOT_IMPLEMENTED', 'ST_NORMALIZATION_FAILED'],
  },
  api_connection: {
    description: '上游 API 连接、TLS、超时、DNS 等网络层问题',
    examples: ['FETCH_FAILED', 'ECONNREFUSED', 'ETIMEDOUT'],
  },
  model_fetch: {
    description: '模型列表或模型元数据拉取失败',
    examples: ['MODELS_LIST_FAILED', 'OPENAI_MODELS_ERROR'],
  },
  chat_runtime: {
    description: '聊天会话装配、正则、流式管道等非推理阶段失败',
    examples: ['REGEX_APPLY_FAILED', 'RUNTIME_BUILD_FAILED'],
  },
  internal: {
    description: '未预期异常或数据库等内部错误',
    examples: ['INTERNAL', 'UNKNOWN'],
  },
};

/** 将细粒度 errorCodes 映射到 errorCategories（用于写入 error_logs） */
export function errorCategoryForErrorCode(code: string | undefined): ErrorCategory {
  if (!code) return errorCategories.internal;
  switch (code) {
    case 'ST_VALIDATION_FAILED':
    case 'ST_NORMALIZATION_FAILED':
    case 'IMPORT_NOT_IMPLEMENTED':
      return errorCategories.import;
    case 'VALIDATION_ERROR':
      return errorCategories.validation;
    default:
      return errorCategories.internal;
  }
}

