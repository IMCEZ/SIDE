import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { charactersApi, type Character, type CharacterDetail, type CreateCharacterData } from '@/api/services/characters'

const CHARACTERS_KEY = 'characters'

export function useCharacters(search?: string) {
  return useQuery<Character[]>({
    queryKey: [CHARACTERS_KEY, { search: search ?? '' }],
    queryFn: () => charactersApi.getList({ search }),
    staleTime: 1000 * 60 * 5,
  })
}

export function useCharacter(id: number) {
  return useQuery<CharacterDetail>({
    queryKey: [CHARACTERS_KEY, id],
    queryFn: () => charactersApi.getById(id),
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCreateCharacter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCharacterData) => charactersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CHARACTERS_KEY] })
    },
  })
}

export function useUpdateCharacter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateCharacterData> }) =>
      charactersApi.update(id, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: [CHARACTERS_KEY, variables.id] })
      qc.invalidateQueries({ queryKey: [CHARACTERS_KEY] })
    },
  })
}

export function useDeleteCharacter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => charactersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CHARACTERS_KEY] })
    },
  })
}

export function useImportCharacter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => charactersApi.import(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CHARACTERS_KEY] })
    },
  })
}

export function useExportCharacter() {
  return useMutation({
    mutationFn: ({ id, format }: { id: number; format: 'png' | 'json' }) =>
      charactersApi.export(id, format),
  })
}
