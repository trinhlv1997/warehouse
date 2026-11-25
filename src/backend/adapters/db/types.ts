/**
 * Minimal SQL port used by every repository. Implemented by D1 today; a PostgreSQL adapter
 * only needs to implement these four methods (plus dialect tweaks, see docs/DOMAIN_MIGRATION.md).
 */
export type SqlValue = string | number | null;

export interface SqlStatement {
  sql: string;
  params?: SqlValue[];
}

export interface SqlRunResult {
  changes: number;
}

export interface SqlDatabase {
  readonly provider: string;
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T | null>;
  run(sql: string, params?: SqlValue[]): Promise<SqlRunResult>;
  /** Executes all statements atomically: either every statement commits or none does. */
  batch(statements: SqlStatement[]): Promise<SqlRunResult[]>;
}
