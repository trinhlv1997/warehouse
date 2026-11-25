import type { SqlDatabase, SqlRunResult, SqlStatement, SqlValue } from "./types";

/** Cloudflare D1 adapter. D1 has no interactive transactions; `batch()` is the atomic unit. */
export class D1SqlDatabase implements SqlDatabase {
  readonly provider = "d1";
  constructor(private readonly db: D1Database) {}

  private prepare(sql: string, params: SqlValue[] = []): D1PreparedStatement {
    const stmt = this.db.prepare(sql);
    return params.length ? stmt.bind(...params) : stmt;
  }

  async all<T>(sql: string, params?: SqlValue[]): Promise<T[]> {
    const res = await this.prepare(sql, params).all<T>();
    return res.results ?? [];
  }

  async first<T>(sql: string, params?: SqlValue[]): Promise<T | null> {
    return (await this.prepare(sql, params).first<T>()) ?? null;
  }

  async run(sql: string, params?: SqlValue[]): Promise<SqlRunResult> {
    const res = await this.prepare(sql, params).run();
    return { changes: res.meta?.changes ?? 0 };
  }

  async batch(statements: SqlStatement[]): Promise<SqlRunResult[]> {
    if (statements.length === 0) return [];
    const results = await this.db.batch(statements.map((s) => this.prepare(s.sql, s.params)));
    return results.map((r) => ({ changes: r.meta?.changes ?? 0 }));
  }
}
