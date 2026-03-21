import { apiClient } from '../client'

export interface ApiConfig {
  id: number
  name: string
  provider: string
  endpoint: string
  apiKey: string
  model: string
  isActive: boolean
  createdAt: number
}

export interface ProviderInfo {
  id: string
  name: string
  provider: string
  defaultEndpoint: string
  requiresApiKey: boolean
  description: string
  defaultModels?: string[]
}

export interface UserSettings {
  theme?: string
  language?: string
  [key: string]: unknown
}

/** 与 /api/v1/api-configs、/api/v1/settings 对齐（勿混用旧版 /settings/api-configs 路径） */
export const settingsApi = {
  getSettings: () => apiClient.get<UserSettings>('/settings'),

  updateSettings: (settings: Array<{ key: string; value: unknown }>) =>
    apiClient.put<void>('/settings', settings),

  getApiConfigs: () => apiClient.get<ApiConfig[]>('/api-configs'),

  getApiConfig: (id: number) => apiClient.get<ApiConfig>(`/api-configs/${id}`),

  createApiConfig: (data: Omit<ApiConfig, 'id' | 'createdAt' | 'isActive'>) =>
    apiClient.post<ApiConfig>('/api-configs', {
      name: data.name,
      provider: data.provider,
      endpoint: data.endpoint,
      api_key: data.apiKey,
      model: data.model,
    }),

  updateApiConfig: (id: number, data: Partial<ApiConfig>) =>
    apiClient.put<ApiConfig>(`/api-configs/${id}`, {
      name: data.name,
      provider: data.provider,
      endpoint: data.endpoint,
      api_key: data.apiKey,
      model: data.model,
    }),

  deleteApiConfig: (id: number) => apiClient.delete<void>(`/api-configs/${id}`),

  setActiveApiConfig: (id: number) => apiClient.put<void>(`/api-configs/${id}/activate`),

  getProviders: () => apiClient.get<ProviderInfo[]>('/api-configs/providers'),

  testConnection: (configId: number) =>
    apiClient.post<{ success: boolean; message?: string }>(`/api-configs/${configId}/test`),

  fetchModels: async (provider: string, endpoint: string, apiKey?: string) => {
    const res = await apiClient.post<{ models: string[] }>('/api-configs/models', {
      provider,
      endpoint,
      apiKey,
    })
    return res.models
  },
}
