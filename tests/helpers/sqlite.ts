import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { SqlDatabase, SqlRunResult, SqlStatement, SqlValue } from "@/backend/adapters/db/types";
import { NoStorageProvider } from "@/backend/adapters/storage/none";
import { loadConfig } from "@/backend/config";
import { buildContainer, type Container } from "@/backend/container";
import { buildDemoStatements } from "@/backend/seed/demoData";
import { hashPassword } from "@/backend/services/crypto";

/**
 * SqlDatabase adapter over better-sqlite3 — proves repositories are not tied to D1 and lets
 * integration tests run the real migrations, constraints and triggers in-process.
 */
export class SqliteDatabase implements SqlDatabase {
  readonly provider = "sqlite";
  constructor(readonly raw: Database.Database) {}

  async all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.raw.prepare(sql).all(...params) as T[];
  }
  async first<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    return (this.raw.prepare(sql).get(...params) as T | undefined) ?? null;
  }
  async run(sql: string, params: SqlValue[] = []): Promise<SqlRunResult> {
    return { changes: this.raw.prepare(sql).run(...params).changes };
  }
  async batch(statements: SqlStatement[]): Promise<SqlRunResult[]> {
    const tx = this.raw.transaction(() => statements.map((s) => ({ changes: this.raw.prepare(s.sql).run(...(s.params ?? [])).changes })));
    return tx();
  }
}

export function createTestDatabase(): SqliteDatabase {
  const raw = new Database(":memory:");
  raw.pragma("foreign_keys = ON");
  const dir = join(process.cwd(), "database/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) raw.exec(readFileSync(join(dir, file), "utf8"));
  return new SqliteDatabase(raw);
}

export async function createSeededContainer(today: string): Promise<{ db: SqliteDatabase; container: Container }> {
  const db = createTestDatabase();
  const statements = buildDemoStatements({ today, passwordHash: await hashPassword("Demo@123", 10_000), reset: false });
  await db.batch(statements);
  const config = loadConfig({ APP_ENV: "test", DEMO_MODE: "true", PASSWORD_HASH_ITERATIONS: "10000" });
  return { db, container: buildContainer(config, db, new NoStorageProvider()) };
}
