import type { NextFunction, Request, Response } from 'express';
import { failureResponse } from '../http/apiResponse';
import { AppError } from './AppError';
import { errorCodes, errorCategoryForErrorCode } from './errorCodes';
import { logServerError } from './errorLogger';
import type { AuthRequest } from '../../middleware/auth';

// 全局错误处理中间件：统一返回结构，同时兼容旧前端字段 `error`
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const userId = (req as AuthRequest).user?.userId;

  // 已知错误（我们自己的骨架）
  if (err instanceof AppError) {
    const importish =
      err.code === errorCodes.ST_VALIDATION_FAILED ||
      err.code === errorCodes.ST_NORMALIZATION_FAILED ||
      err.code === errorCodes.IMPORT_NOT_IMPLEMENTED;
    if (err.status >= 500 || importish) {
      void logServerError({
        userId,
        category: errorCategoryForErrorCode(err.code),
        message: err.message,
        details: { path: req.path, code: err.code, status: err.status },
      });
    }
    return res.status(err.status).json(
      failureResponse({
        status: err.status,
        message: err.message,
        code: err.code,
        data: err.data,
        warnings: err.warnings,
      })
    );
  }

  // 普通 Error
  if (err instanceof Error) {
    void logServerError({
      userId,
      category: errorCategoryForErrorCode(errorCodes.INTERNAL),
      message: err.message || 'Internal server error',
      details: { path: req.path, stack: err.stack },
    });
    return res.status(500).json(
      failureResponse({
        status: 500,
        message: err.message || 'Internal server error',
        code: errorCodes.INTERNAL,
      })
    );
  }

  // 非 Error 抛出
  void logServerError({
    userId,
    category: errorCategoryForErrorCode(errorCodes.UNKNOWN),
    message: 'Non-Error thrown',
    details: { path: req.path, err },
  });
  return res.status(500).json(
    failureResponse({
      status: 500,
      message: 'Internal server error',
      code: errorCodes.UNKNOWN,
    })
  );
}

