import { apiClient } from '../client'

export interface WorldBookEntry {
  id: string
  keys: string[]
  content: string
  order: number
  enabled: boolean
  position: 'before' | 'after'
  probability?: number
}

export interface WorldBook {
  id: number
  name: string
  description?: string
  entries: WorldBookEntry[]
  createdAt: number
  updatedAt: number
  entryCount?: number
}

export interface CreateWorldBookData {
  name: string
  description?: string
  entries?: WorldBookEntry[]
}

export const worldsApi = {
  getList: (search?: string) =>
    apiClient.get<WorldBook[]>('/worlds', {
      params: search ? { search } : undefined,
    }),

  getById: (id: number) =>
    apiClient.get<WorldBook>(`/worlds/${id}`),

  create: (data: CreateWorldBookData) =>
    apiClient.post<WorldBook>('/worlds', {
      name: data.name,
      data: { entries: data.entries || [] },
    }),

  update: (id: number, data: Partial<CreateWorldBookData>) =>
    apiClient.put<WorldBook>(`/worlds/${id}`, {
      name: data.name,
      data: { entries: data.entries || [] },
    }),

  delete: (id: number) =>
    apiClient.delete<void>(`/worlds/${id}`),

  import: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<WorldBook>('/worlds/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  export: (id: number) =>
    apiClient.get<Blob>(`/worlds/${id}/export`, {
      responseType: 'blob',
    }),
}
