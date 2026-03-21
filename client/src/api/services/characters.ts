import { apiClient } from '../client'
import type { PaginationParams } from '../types'
import type { ApiWarning } from '../apiErrorTypes'

export interface Character {
  id: number
  name: string
  avatarPath: string | null
  createdAt: number
  description?: string
  personality?: string
  scenario?: string
  firstMes?: string
  mesExample?: string
  warnings?: ApiWarning[]
}

export interface CharacterDetail extends Character {
  data: Record<string, unknown>
}

export interface CreateCharacterData {
  name: string
  description?: string
  personality?: string
  scenario?: string
  firstMes?: string
  avatar?: File
}

export const charactersApi = {
  getList: (params?: PaginationParams) =>
    apiClient.get<Character[]>('/characters', {
      params: params?.search ? { search: params.search } : undefined,
    }),

  getById: (id: number) =>
    apiClient.get<CharacterDetail>(`/characters/${id}`),

  create: (data: CreateCharacterData) => {
    const formData = new FormData()
    formData.append('name', data.name)
    if (data.description) formData.append('description', data.description)
    if (data.personality) formData.append('personality', data.personality)
    if (data.scenario) formData.append('scenario', data.scenario)
    if (data.firstMes) formData.append('firstMes', data.firstMes)
    if (data.avatar) formData.append('avatar', data.avatar)

    return apiClient.post<Character>('/characters', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  update: (id: number, data: Partial<CreateCharacterData>) => {
    const formData = new FormData()
    if (data.name) formData.append('name', data.name)
    if (data.description !== undefined) formData.append('description', data.description)
    if (data.personality !== undefined) formData.append('personality', data.personality)
    if (data.scenario !== undefined) formData.append('scenario', data.scenario)
    if (data.firstMes !== undefined) formData.append('firstMes', data.firstMes)
    if (data.avatar) formData.append('avatar', data.avatar)

    return apiClient.put<Character>(`/characters/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  delete: (id: number) => apiClient.delete<void>(`/characters/${id}`),

  import: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<Character>('/characters/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  export: (id: number, format: 'png' | 'json' = 'json') =>
    apiClient.get<Blob>(`/characters/${id}/export?format=${format}`, {
      responseType: 'blob',
    }),

  getAvatarUrl: (id: number) => `/api/v1/characters/${id}/avatar`,
}
