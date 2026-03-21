import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chatApi, type ChatSession, type ChatMessage, type CreateSessionData } from '@/api/services/chat'

const SESSIONS_KEY = 'chat-sessions'
const MESSAGES_KEY = 'chat-messages'

export function useChatSessions() {
  return useQuery<ChatSession[]>({
    queryKey: [SESSIONS_KEY],
    queryFn: () => chatApi.getSessions(),
    staleTime: 1000 * 60 * 2,
  })
}

export function useChatSession(id: number | null) {
  return useQuery<ChatSession>({
    queryKey: [SESSIONS_KEY, id],
    queryFn: () => chatApi.getSession(id!),
    enabled: id !== null && Number.isFinite(id),
    staleTime: 1000 * 60 * 2,
  })
}

export function useChatMessages(sessionId: number | null) {
  return useQuery<ChatMessage[]>({
    queryKey: [MESSAGES_KEY, sessionId],
    queryFn: () => chatApi.getMessages(sessionId!),
    enabled: sessionId !== null && Number.isFinite(sessionId),
    staleTime: 1000 * 60,
  })
}

export function useCreateChatSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSessionData) => chatApi.createSession(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SESSIONS_KEY] })
    },
  })
}

export function useOpenChatSessionByCharacter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (characterId: number) => chatApi.openSessionByCharacter(characterId),
    onSuccess: (session) => {
      qc.setQueryData([SESSIONS_KEY, session.id], session)
      qc.invalidateQueries({ queryKey: [SESSIONS_KEY] })
    },
  })
}

export function useDeleteChatSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => chatApi.deleteSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SESSIONS_KEY] })
    },
  })
}
