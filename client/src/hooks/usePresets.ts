import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { presetsApi, type Preset, type CreatePresetData } from '@/api/services/presets'

const PRESETS_KEY = 'presets'

export function usePresets() {
  return useQuery<Preset[]>({
    queryKey: [PRESETS_KEY],
    queryFn: () => presetsApi.getList(),
    staleTime: 1000 * 60 * 5,
  })
}

export function usePreset(id: number | null) {
  return useQuery<Preset>({
    queryKey: [PRESETS_KEY, id],
    queryFn: () => presetsApi.getById(id!),
    enabled: id !== null && Number.isFinite(id),
    staleTime: 1000 * 60 * 5,
  })
}

export function useCreatePreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePresetData) => presetsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRESETS_KEY] })
    },
  })
}

export function useUpdatePreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreatePresetData> }) =>
      presetsApi.update(id, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: [PRESETS_KEY, variables.id] })
      qc.invalidateQueries({ queryKey: [PRESETS_KEY] })
    },
  })
}

export function useDeletePreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => presetsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRESETS_KEY] })
    },
  })
}

export function useSetDefaultPreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => presetsApi.setDefault(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRESETS_KEY] })
    },
  })
}

export function useImportPreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => presetsApi.import(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRESETS_KEY] })
    },
  })
}

export function useExportPreset() {
  return useMutation({
    mutationFn: (id: number) => presetsApi.export(id),
  })
}
