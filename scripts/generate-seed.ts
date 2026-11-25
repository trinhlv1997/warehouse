/**
 * Generates database/seeds/seed.generated.sql from the shared demo-data module.
 *   tsx scripts/generate-seed.ts          -> idempotent seed (INSERT OR IGNORE)
 *   tsx scripts/generate-seed.ts --reset  -> wipes demo tenant data first, then seeds
 * Then: wrangler d1 execute DB --local|--remote --file database/seeds/seed.generated.sql
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { businessDate } from "../src/backend/domain/dates";
import { DEMO_PASSWORD, buildDemoStatements, toSqlScript } from "../src/backend/seed/demoData";
import { hashPassword } from "../src/backend/services/crypto";

const reset = process.argv.includes("--reset");
const iterations = Number(process.env.PASSWORD_HASH_ITERATIONS) || 50_000;
const today = businessDate(new Date(), process.env.DEFAULT_TIMEZONE || "Asia/Ho_Chi_Minh");
const passwordHash = await hashPassword(DEMO_PASSWORD, iterations);
const statements = buildDemoStatements({ today, passwordHash, reset });

const out = resolve("database/seeds/seed.generated.sql");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `-- Generated ${new Date().toISOString()} for business date ${today}${reset ? " (reset)" : ""}\n${toSqlScript(statements)}\n`);
console.log(`Wrote ${statements.length} statements to ${out} (business date ${today}${reset ? ", reset" : ""})`);
