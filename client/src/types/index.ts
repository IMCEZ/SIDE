// 全局类型定义

export interface PaginationParams {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiError {
  message: string
  code?: string
  status?: number
}

// 通用响应类型
export interface ApiResponse<T = unknown> {
  data: T
  message?: string
  success: boolean
}
