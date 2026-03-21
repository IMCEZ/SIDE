import { getDb, saveDb } from '../../db';
import type { ErrorCategory } from './errorCodes';

export async function logServerError(options: {
  userId?: number | null;
  category: ErrorCategory;
  message: string;
  details?: Record<string, unknown>;
  jobId?: number | null;
}): Promise<void> {
  try {
    const database = await getDb();
    const stmt = database.prepare(
      'INSERT INTO error_logs (user_id, job_id, code, message, details, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run([
      options.userId ?? null,
      options.jobId ?? null,
      options.category,
      options.message,
      JSON.stringify(options.details ?? {}),
      Date.now(),
    ]);
    stmt.free();
    saveDb();
  } catch {
    // ignore logging failures
  }
}
