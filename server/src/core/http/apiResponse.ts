export type ApiWarning = {
  code?: string;
  message: string;
  path?: string;
};

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  message?: string;
  warnings?: ApiWarning[];
};

export type ApiFailureResponse = {
  success: false;
  // 兼容旧前端：很多页面仍读取 `json.error`
  error: string;
  message: string;
  status: number;
  code?: string;
  data?: unknown;
  warnings?: ApiWarning[];
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse;

export function successResponse<T>(data: T, options?: { message?: string; warnings?: ApiWarning[] }): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message: options?.message,
    warnings: options?.warnings,
  };
}

export function failureResponse(
  options: {
    status: number;
    message: string;
    code?: string;
    data?: unknown;
    warnings?: ApiWarning[];
  }
): ApiFailureResponse {
  return {
    success: false,
    error: options.message,
    message: options.message,
    status: options.status,
    code: options.code,
    data: options.data,
    warnings: options.warnings,
  };
}

