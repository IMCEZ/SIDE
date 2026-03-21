import { apiClient } from '../client'

export interface PromptBlock {
  identifier: string
  name: string
  content: string
  enabled: boolean
  system: boolean
  order: number
}

export interface ModelParams {
  temperature: number
  maxTokens: number
  topP: number
  topK: number
  frequencyPenalty: number
  presencePenalty: number
  repetitionPenalty: number
  seed: number
}

export interface Preset {
  id: number
  name: string
  isDefault: boolean
  createdAt: number
  updatedAt: number
  data: {
    params: ModelParams
    promptOrder: PromptBlock[]
  }
}

export interface CreatePresetData {
  name: string
  params: ModelParams
  promptOrder: PromptBlock[]
  isDefault?: boolean
}

export const presetsApi = {
  getList: () =>
    apiClient.get<Preset[]>('/presets'),

  getById: (id: number) =>
    apiClient.get<Preset>(`/presets/${id}`),

  create: (data: CreatePresetData) =>
    apiClient.post<Preset>('/presets', {
      name: data.name,
      data: {
        params: data.params,
        promptOrder: data.promptOrder,
      },
      isDefault: data.isDefault,
    }),

  update: (id: number, data: Partial<CreatePresetData>) =>
    apiClient.put<Preset>(`/presets/${id}`, {
      name: data.name,
      data:
        data.params != null || data.promptOrder != null
          ? {
              ...(data.params != null ? { params: data.params } : {}),
              ...(data.promptOrder != null ? { promptOrder: data.promptOrder } : {}),
            }
          : undefined,
      isDefault: data.isDefault,
    }),

  delete: (id: number) =>
    apiClient.delete<void>(`/presets/${id}`),

  setDefault: (id: number) =>
    apiClient.put<Preset>(`/presets/${id}/default`),

  import: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<Preset>('/presets/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  export: (id: number) =>
    apiClient.get<Blob>(`/presets/${id}/export`, {
      responseType: 'blob',
    }),
}
