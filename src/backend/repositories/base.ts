import type { PageMeta } from "../../shared/types";
import type { SqlDatabase, SqlValue } from "../adapters/db/types";

/** `?, ?, ?` for IN (...) lists. Values are always bound, never interpolated. */
export function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

/** Escape LIKE wildcards in user search input. */
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export interface PageRequest {
  page: number;
  pageSize: number;
}

/** Runs `SELECT COUNT(*)` + a LIMIT/OFFSET query over the same FROM/WHERE fragment. */
export async function paginate<T>(
  db: SqlDatabase,
  select: string,
  fromWhere: string,
  params: SqlValue[],
  orderBy: string,
  page: PageRequest,
): Promise<{ items: T[]; meta: PageMeta }> {
  const countRow = await db.first<{ total: number }>(`SELECT COUNT(*) AS total FROM (SELECT 1 ${fromWhere}) t`, params);
  const total = countRow?.total ?? 0;
  const offset = (page.page - 1) * page.pageSize;
  const items = await db.all<T>(`SELECT ${select} ${fromWhere} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, page.pageSize, offset]);
  return { items, meta: { page: page.page, pageSize: page.pageSize, total, totalPages: Math.max(1, Math.ceil(total / page.pageSize)) } };
}

/** Small builder for optional WHERE conditions with bound parameters. */
export class Where {
  readonly clauses: string[] = [];
  readonly params: SqlValue[] = [];

  add(clause: string, ...params: SqlValue[]): this {
    this.clauses.push(clause);
    this.params.push(...params);
    return this;
  }

  addIf(condition: unknown, clause: string, ...params: SqlValue[]): this {
    if (condition !== undefined && condition !== null && condition !== "") this.add(clause, ...params);
    return this;
  }

  toSql(): string {
    return this.clauses.length ? `WHERE ${this.clauses.join(" AND ")}` : "";
  }
}

export const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
