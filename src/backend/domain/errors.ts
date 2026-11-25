import type { ErrorCode } from "../../shared/constants";

const STATUS_BY_CODE: Partial<Record<ErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  CSRF_INVALID: 403,
  ACCOUNT_DISABLED: 403,
  DEMO_DISABLED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DUPLICATE: 409,
  STOCK_CHANGED: 409,
  INVALID_STATUS_TRANSITION: 409,
  IN_USE: 409,
  INSUFFICIENT_STOCK: 422,
  BIN_CAPACITY_EXCEEDED: 422,
  BIN_INACTIVE: 422,
  LOT_MISMATCH: 422,
  LOT_NOT_AVAILABLE: 422,
  RATE_LIMITED: 429,
  STORAGE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

/** Business/application error with a stable machine-readable code. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? code);
    this.status = STATUS_BY_CODE[code] ?? 400;
  }
}

/** Map SQLite constraint / trigger failures (D1 and better-sqlite3 alike) to AppErrors. */
export function mapDatabaseError(error: unknown): AppError | null {
  const message = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : String(error);
  if (message.includes("BIN_CAPACITY_EXCEEDED")) return new AppError("BIN_CAPACITY_EXCEEDED", "Bin capacity exceeded");
  if (message.includes("BIN_INACTIVE")) return new AppError("BIN_INACTIVE", "Bin is inactive");
  if (message.includes("INVALID_STATUS_TRANSITION")) return new AppError("INVALID_STATUS_TRANSITION", "Document already processed");
  if (/CHECK constraint failed.*quantity/i.test(message)) return new AppError("STOCK_CHANGED", "Stock changed; balance would go negative");
  if (/UNIQUE constraint failed/i.test(message)) return new AppError("DUPLICATE", "Duplicate record", { constraint: message.match(/UNIQUE constraint failed: ([^\s]+)/)?.[1] });
  if (/FOREIGN KEY constraint failed/i.test(message)) return new AppError("IN_USE", "Referenced record missing or still in use");
  return null;
}
