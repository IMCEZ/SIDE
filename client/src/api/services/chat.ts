import { apiClient } from '../client'

export interface ChatSession {
  id: number
  userId: number | null
  characterId: number | null
  title: string | null
  status: string | null
  presetId: number | null
  apiProfileId: number | null
  worldbookIds: number[]
  regexRulesetId: number | null
  createdAt: number
  updatedAt: number
}

export interface ChatMessage {
  id: number
  chatSessionId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  contentFormat: string
  metadata: Record<string, unknown>
  status: string
  createdAt: number
}

export interface CreateSessionData {
  characterId?: number | null
  title?: string
  presetId?: number | null
  apiProfileId?: number | null
  worldbookIds?: number[]
  regexRulesetId?: number | null
}

export interface OpenSessionByCharacterResponse extends ChatSession {
  reused: boolean
}

export const chatApi = {
  getSessions: () =>
    apiClient.get<ChatSession[]>('/chat/sessions'),

  getSession: (id: number) =>
    apiClient.get<ChatSession>(`/chat/sessions/${id}`),

  createSession: (data: CreateSessionData) =>
    apiClient.post<ChatSession>('/chat/sessions', data),

  openSessionByCharacter: (characterId: number) =>
    apiClient.post<OpenSessionByCharacterResponse>(`/chat/sessions/by-character/${characterId}/open`),

  deleteSession: (id: number) =>
    apiClient.delete<void>(`/chat/sessions/${id}`),

  getMessages: (sessionId: number) =>
    apiClient.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`),

  getRecentSessions: (limit = 10) =>
    apiClient.get<{ items: ChatSession[]; limit: number }>(`/chat/sessions/recent?limit=${limit}`),
}
