// WebCrypto helpers (available in Workers and Node >= 20). No secrets are logged or returned.

const encoder = new TextEncoder();
/** Workers caps PBKDF2 at 100k iterations (the maximum accepted when verifying). */
export const PBKDF2_ITERATIONS = 100_000;
/** Default for new hashes; see AppConfig.passwordIterations. */
export const DEFAULT_PASSWORD_ITERATIONS = 50_000;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Constant-time comparison of two strings. */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Format: pbkdf2-sha256$<iterations>$<salt b64>$<hash b64> */
export async function hashPassword(password: string, iterations = DEFAULT_PASSWORD_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, iterations);
  return ["pbkdf2-sha256", String(iterations), toBase64(salt), toBase64(hash)].join("$");
}

export function hashIterations(stored: string): number {
  return Number(stored.split("$")[1]) || 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2-sha256" || !iter || !saltB64 || !hashB64) return false;
  const iterations = Number(iter);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) return false;
  const hash = await pbkdf2(password, fromBase64(saltB64), iterations);
  return timingSafeEqual(toBase64(hash), hashB64);
}

/** HMAC-SHA256(value, secret) as hex. Used to store session ids without keeping raw tokens. */
export async function hmacSha256(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}
