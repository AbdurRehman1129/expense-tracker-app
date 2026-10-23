export type DbErrorCode =
  | 'INSUFFICIENT_DUE'
  | 'DUE_IN_USE'
  | 'LOCKED_ENTRY'
  | 'BACKUP_TOO_NEW'
  | 'INVALID_BACKUP';

/** Expected, user-explainable failures from the data layer (not bugs). */
export class DbError extends Error {
  code: DbErrorCode;
  details: Record<string, number>;

  constructor(code: DbErrorCode, message: string, details: Record<string, number> = {}) {
    super(message);
    this.name = 'DbError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, DbError.prototype);
  }
}

export function isDbError(err: unknown, code?: DbErrorCode): err is DbError {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { name?: string; code?: string };
  return e.name === 'DbError' && (code === undefined || e.code === code);
}
