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

