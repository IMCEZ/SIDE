import type { ApiWarning } from '../../core/http/apiResponse';
import type { ImportNormalizedData } from '../st/types';

export type ImportSuccess<T> = {
  success: true;
  data: T;
  warnings?: ApiWarning[];
};

export type ImportFailure = {
  success: false;
  error: string;
  code?: string;
  warnings?: ApiWarning[];
};

export type ImportResult<T> = ImportSuccess<T> | ImportFailure;

export type ImportResourceKind = ImportNormalizedData['kind'];

export type ImportRequest = {
  kind: ImportResourceKind;
  stPayload: unknown;
  // skeleton：后续用于绑定数据库的 user_id/import_jobs 等
  userId?: number;
};

