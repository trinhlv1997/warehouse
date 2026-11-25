import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath, URL } from "node:url";

// `vite dev` chạy SPA + Worker (Hono API, D1, R2 local) trong cùng một tiến trình qua workerd.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  build: {
    // main chunk = React + Radix + i18n + shared zod schemas (~170 kB gzip); charts are lazy-loaded
    chunkSizeWarningLimit: 700,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
