import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull()
});

export const characters = sqliteTable('characters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  filePath: text('file_path'),
  data: text('data'),
  avatarPath: text('avatar_path'),
  createdAt: integer('created_at', { mode: 'number' }),
  updatedAt: integer('updated_at', { mode: 'number' })
});

export const conversations = sqliteTable('conversations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  characterId: integer('character_id').references(() => characters.id),
  title: text('title'),
  createdAt: integer('created_at', { mode: 'number' }),
  updatedAt: integer('updated_at', { mode: 'number' })
});

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationId: integer('conversation_id').references(() => conversations.id),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull()
});

export const worldBooks = sqliteTable('world_books', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name'),
  data: text('data'),
  createdAt: integer('created_at', { mode: 'number' })
});

export const presets = sqliteTable('presets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name'),
  data: text('data'),
  isDefault: integer('is_default', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' })
});

export const apiConfigs = sqliteTable('api_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name'),
  provider: text('provider').notNull(),
  endpoint: text('endpoint'),
  apiKey: text('api_key'),
  model: text('model'),
  isActive: integer('is_active', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' })
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value')
});

// ================================
// ST/四资源兼容骨架：最小表结构（不影响现有业务表）
// ================================

export const worldbooks = sqliteTable('worldbooks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name'),
  // 原始/归一化 JSON 数据（骨架阶段）
  data: text('data'),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'number' }),
  updatedAt: integer('updated_at', { mode: 'number' })
});

export const worldbook_entries = sqliteTable('worldbook_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  worldbookId: integer('worldbook_id'),
  // 骨架阶段：允许以 JSON 形式落地
  keys: text('keys'),
  content: text('content'),
  entryOrder: integer('entry_order'),
  enabled: integer('enabled'),
  position: text('position'),
  probability: text('probability'),
  data: text('data'),
  createdAt: integer('created_at', { mode: 'number' })
});

export const preset_prompts = sqliteTable('preset_prompts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  presetId: integer('preset_id'),
  identifier: text('identifier'),
  name: text('name'),
  content: text('content'),
  enabled: integer('enabled'),
  system: integer('system'),
  sortOrder: integer('sort_order'),
  data: text('data'),
  createdAt: integer('created_at', { mode: 'number' })
});

export const regex_rulesets = sqliteTable('regex_rulesets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name'),
  data: text('data'),
  createdAt: integer('created_at', { mode: 'number' })
});

export const api_profiles = sqliteTable('api_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name'),
  provider: text('provider').notNull(),
  endpoint: text('endpoint'),
  apiKey: text('api_key'),
  model: text('model'),
  isActive: integer('is_active'),
  createdAt: integer('created_at', { mode: 'number' })
});

export const chat_sessions = sqliteTable('chat_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  characterId: integer('character_id'),
  title: text('title'),
  status: text('status'),
  presetId: integer('preset_id'),
  apiProfileId: integer('api_profile_id'),
  worldbookIds: text('worldbook_ids'),
  regexRulesetId: integer('regex_ruleset_id'),
  createdAt: integer('created_at', { mode: 'number' }),
  updatedAt: integer('updated_at', { mode: 'number' })
});

export const chat_messages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chatSessionId: integer('chat_session_id'),
  role: text('role').notNull(),
  content: text('content').notNull(),
  contentFormat: text('content_format'),
  metadata: text('metadata'),
  status: text('status'),
  createdAt: integer('created_at', { mode: 'number' })
});

export const import_jobs = sqliteTable('import_jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  resourceKind: text('resource_kind'),
  status: text('status'),
  rawData: text('raw_data'),
  // 骨架阶段：直接把 ST 原始/归一化数据落地成 JSON
  normalizedData: text('normalized_data'),
  errorText: text('error_text'),
  createdAt: integer('created_at', { mode: 'number' }),
  startedAt: integer('started_at', { mode: 'number' }),
  finishedAt: integer('finished_at', { mode: 'number' })
});

export const error_logs = sqliteTable('error_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  jobId: integer('job_id'),
  code: text('code'),
  message: text('message'),
  details: text('details'),
  createdAt: integer('created_at', { mode: 'number' })
});

