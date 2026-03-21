import type { ApiWarning } from '../http/apiResponse';
import type { ErrorCode } from './errorCodes';

export class AppError extends Error {
  public readonly code?: ErrorCode;
  public readonly status: number;
  public readonly data?: unknown;
  public readonly warnings?: ApiWarning[];

  constructor(options: {
    message: string;
    status?: number;
    code?: ErrorCode;
    data?: unknown;
    warnings?: ApiWarning[];
    cause?: unknown;
  }) {
    super(options.message);
    this.name = 'AppError';
    this.status = options.status ?? 500;
    this.code = options.code;
    this.data = options.data;
    this.warnings = options.warnings;

    // node >= 16: preserve cause for debugging
    if (options.cause !== undefined) {
      (this as any).cause = options.cause;
    }
  }
}

