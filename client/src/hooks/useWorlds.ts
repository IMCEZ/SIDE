import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { worldsApi, type WorldBook, type CreateWorldBookData } from '@/api/services/worlds'

const WORLDS_KEY = 'worlds'

export function useWorlds(search?: string) {
  return useQuery<WorldBook[]>({
    queryKey: [WORLDS_KEY, { search: search ?? '' }],
    queryFn: () => worldsApi.getList(search),
    staleTime: 1000 * 60 * 5,
  })
}

export function useWorld(id: number | null) {
  return useQuery<WorldBook>({
    queryKey: [WORLDS_KEY, id],
    queryFn: () => worldsApi.getById(id!),
    enabled: id !== null && Number.isFinite(id),
    staleTime: 1000 * 60 * 5,
  })
}

export function useCreateWorld() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateWorldBookData) => worldsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WORLDS_KEY] })
    },
  })
}

export function useUpdateWorld() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateWorldBookData> }) =>
      worldsApi.update(id, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: [WORLDS_KEY, variables.id] })
      qc.invalidateQueries({ queryKey: [WORLDS_KEY] })
    },
  })
}

export function useDeleteWorld() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => worldsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WORLDS_KEY] })
    },
  })
}

export function useImportWorld() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => worldsApi.import(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WORLDS_KEY] })
    },
  })
}

export function useExportWorld() {
  return useMutation({
    mutationFn: (id: number) => worldsApi.export(id),
  })
}
