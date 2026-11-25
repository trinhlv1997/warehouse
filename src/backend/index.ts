// Cloudflare Worker entry. Static SPA assets are served by Workers Static Assets;
// only /api/* and /files/* reach this code (see "run_worker_first" in wrangler.jsonc).
import { createApp } from "./app";

const app = createApp();

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
