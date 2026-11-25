import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { PageMeta } from "../../shared/types";

/** Consistent envelope: `{ data, meta? }` for success, `{ error }` for failures (see app.ts onError). */
export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200): Response {
  return c.json({ data } as never, status);
}

export function paged<T>(c: Context, result: { items: T[]; meta: PageMeta }): Response {
  return c.json({ data: result.items, meta: result.meta } as never);
}
