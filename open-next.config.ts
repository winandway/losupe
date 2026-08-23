import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Sin caché incremental: todas las páginas se sirven dinámicas desde D1 (baratas y siempre frescas).
export default defineCloudflareConfig({});
