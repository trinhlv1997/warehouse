import type { SqlStatement } from "../adapters/db/types";
import { AppError, mapDatabaseError } from "../domain/errors";
import type { Repositories } from "../repositories";

/**
 * Executes statements as one atomic batch and translates constraint/trigger failures
 * (negative stock, bin capacity, double confirmation, duplicates) into AppErrors.
 */
export async function runAtomic(repos: Repositories, statements: SqlStatement[]): Promise<void> {
  try {
    await repos.operations.execute(statements);
  } catch (error) {
    throw mapDatabaseError(error) ?? error;
  }
}

/** Wraps a single repository call with the same error translation. */
export async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw mapDatabaseError(error) ?? error;
  }
}
