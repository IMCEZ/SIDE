import { apiClient } from '../client'

export interface AuthStatus {
  hasUser: boolean
}

export interface LoginCredentials {
  password: string
}

export interface SetupCredentials {
  username: string
  password: string
}

export interface AuthResponse {
  token: string
}

export const authApi = {
  getStatus: () => apiClient.get<AuthStatus>('/auth/status'),

  login: (credentials: LoginCredentials) =>
    apiClient.post<AuthResponse>('/auth/login', credentials),

  setup: (credentials: SetupCredentials) =>
    apiClient.post<AuthResponse>('/auth/setup', credentials),

  verify: () => apiClient.get<{ ok: boolean }>('/auth/verify'),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.put<void>('/auth/password', {
      oldPassword: data.currentPassword,
      newPassword: data.newPassword,
    }),
}
