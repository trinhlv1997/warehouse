export function newId(): string {
  return crypto.randomUUID();
}

/** Human-friendly document number, e.g. PN-261124-7KQ2. Uniqueness is enforced by the database. */
export function documentNumber(prefix: string, businessDate: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${prefix}-${businessDate.slice(2).replaceAll("-", "")}-${suffix}`;
}
