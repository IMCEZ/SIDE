import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi, type LoginCredentials, type SetupCredentials } from '@/api/services/auth'
import { useAuthStore } from '@/stores/authStore'

const AUTH_STATUS_KEY = 'authStatus'

export function useAuthStatus() {
  return useQuery({
    queryKey: [AUTH_STATUS_KEY],
    queryFn: () => authApi.getStatus(),
    staleTime: 1000 * 60 * 5,
  })
}

export function useLogin() {
  const navigate = useNavigate()
  const { login } = useAuthStore()

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data) => {
      login(data.token)
      navigate('/characters')
    },
  })
}

export function useSetup() {
  const navigate = useNavigate()
  const { login } = useAuthStore()

  return useMutation({
    mutationFn: (credentials: SetupCredentials) => authApi.setup(credentials),
    onSuccess: (data) => {
      login(data.token)
      navigate('/characters')
    },
  })
}

export function useVerifyToken() {
  return useQuery({
    queryKey: ['verifyToken'],
    queryFn: () => authApi.verify(),
    retry: false,
    enabled: false,
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(data),
  })
}
