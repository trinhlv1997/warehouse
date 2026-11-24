import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Site không dùng ISR/revalidate nên đọc trang prerender thẳng từ Workers static assets
// (miễn phí, không cần R2). Nếu sau này cần revalidate, đổi sang R2/KV incremental cache.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
