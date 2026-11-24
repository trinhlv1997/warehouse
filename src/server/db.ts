import { getCloudflareContext } from "@opennextjs/cloudflare";

// Bindings của Worker (D1, secrets). Khi chạy `next dev`, initOpenNextCloudflareForDev
// cung cấp D1 local (.wrangler/state) và biến trong .dev.vars.
export async function getEnv(): Promise<CloudflareEnv> {
  return (await getCloudflareContext({ async: true })).env;
}

export async function getDb(): Promise<D1Database> {
  return (await getEnv()).DB;
}
