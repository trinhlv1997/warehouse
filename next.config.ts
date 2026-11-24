import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

export default nextConfig;

// Cho phép `next dev` truy cập Cloudflare bindings (getCloudflareContext).
initOpenNextCloudflareForDev();
