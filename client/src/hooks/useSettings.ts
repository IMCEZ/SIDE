import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi, type ApiConfig, type ProviderInfo, type UserSettings } from '@/api/services/settings'

const SETTINGS_KEY = 'settings'
const API_CONFIGS_KEY = 'apiConfigs'
const PROVIDERS_KEY = 'providers'

export function useSettings() {
  return useQuery<UserSettings>({
    queryKey: [SETTINGS_KEY],
    queryFn: () => settingsApi.getSettings(),
    staleTime: 1000 * 60 * 5,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (settings: Array<{ key: string; value: unknown }>) =>
      settingsApi.updateSettings(settings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SETTINGS_KEY] })
    },
  })
}

export function useApiConfigs() {
  return useQuery<ApiConfig[]>({
    queryKey: [API_CONFIGS_KEY],
    queryFn: () => settingsApi.getApiConfigs(),
    staleTime: 1000 * 60 * 2,
  })
}

export function useApiConfig(id: number | null) {
  return useQuery<ApiConfig>({
    queryKey: [API_CONFIGS_KEY, id],
    queryFn: () => settingsApi.getApiConfig(id!),
    enabled: id !== null && Number.isFinite(id),
    staleTime: 1000 * 60 * 2,
  })
}

export function useCreateApiConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<ApiConfig, 'id' | 'createdAt'>) =>
      settingsApi.createApiConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [API_CONFIGS_KEY] })
    },
  })
}

export function useUpdateApiConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ApiConfig> }) =>
      settingsApi.updateApiConfig(id, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: [API_CONFIGS_KEY, variables.id] })
      qc.invalidateQueries({ queryKey: [API_CONFIGS_KEY] })
    },
  })
}

export function useDeleteApiConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => settingsApi.deleteApiConfig(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [API_CONFIGS_KEY] })
    },
  })
}

export function useSetActiveApiConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => settingsApi.setActiveApiConfig(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [API_CONFIGS_KEY] })
    },
  })
}

export function useProviders() {
  return useQuery<ProviderInfo[]>({
    queryKey: [PROVIDERS_KEY],
    queryFn: () => settingsApi.getProviders(),
    staleTime: 1000 * 60 * 60,
  })
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (configId: number) => settingsApi.testConnection(configId),
  })
}

export function useFetchModels() {
  return useMutation({
    mutationFn: ({ provider, endpoint, apiKey }: { provider: string; endpoint: string; apiKey?: string }) =>
      settingsApi.fetchModels(provider, endpoint, apiKey),
  })
}
