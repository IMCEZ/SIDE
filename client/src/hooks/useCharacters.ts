import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export interface CharacterListItem {
  id: number;
  name: string;
  avatarPath: string | null;
  createdAt: number | null;
}

export interface CharacterDetail extends CharacterListItem {
  data: unknown;
}

function authHeaders() {
  const token = localStorage.getItem('side_token');
  return token
    ? {
        Authorization: `Bearer ${token}`
      }
    : undefined;
}

export function useCharacters(search?: string) {
  return useQuery<CharacterListItem[]>({
    queryKey: ['characters', { search: search ?? '' }],
    queryFn: async () => {
      const res = await axios.get<CharacterListItem[]>('/api/v1/characters', {
        params: search ? { search } : undefined,
        headers: authHeaders()
      });
      return res.data;
    }
  });
}

export function useCharacter(id: number) {
  return useQuery<CharacterDetail>({
    queryKey: ['character', id],
    queryFn: async () => {
      const res = await axios.get<CharacterDetail>(`/api/v1/characters/${id}`, {
        headers: authHeaders()
      });
      return res.data;
    },
    enabled: Number.isFinite(id)
  });
}

export function useImportCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post('/api/v1/characters/import', fd, {
        headers: {
          ...authHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['characters'] });
    }
  });
}

export function useDeleteCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`/api/v1/characters/${id}`, {
        headers: authHeaders()
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['characters'] });
    }
  });
}

