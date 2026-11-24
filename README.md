# Quản lý kho (WarehouseManagement)

Next.js 15 + React 19 + TypeScript + Tailwind CSS v4, chạy trên Cloudflare Workers (OpenNext) với D1.

```bash
npm install
npm run dev   # http://localhost:3000
```

Trước khi deploy lần đầu: `npx wrangler d1 create warehouse-management-db` rồi cập nhật `database_id` trong `wrangler.jsonc`.
