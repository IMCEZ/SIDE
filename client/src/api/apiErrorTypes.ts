export type ApiWarning = {
  code?: string;
  message: string;
  path?: string;
};

// 与后端骨架保持一致：success / error / warnings
export type SideApiErrorResponse = {
  success: false;
  error: string;
  message: string;
  status: number;
  code?: string;
  warnings?: ApiWarning[];
  data?: unknown;
};

export type SideApiSuccessResponse<T> = {
  success: true;
  data: T;
  message?: string;
  warnings?: ApiWarning[];
};

export type SideApiResponse<T> = SideApiSuccessResponse<T> | SideApiErrorResponse;

export function isSideApiErrorResponse(value: unknown): value is SideApiErrorResponse {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return v.success === false && typeof v.message === 'string' && typeof v.status === 'number';
}

