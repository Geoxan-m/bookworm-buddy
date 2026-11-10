/** Server-side abuse guard. Buckets are derived on the server, never from client input. */

export type LimitRule = { bucket: string; max: number; windowSeconds: number };
export type HitFn = (rule: LimitRule) => Promise<boolean>;

/** Limits per window. A global cap protects upstream sources; per-client caps stop one caller. */
export const LIMITS = {
  externalGlobal: { max: 300, windowSeconds: 60 },
  externalClient: { max: 30, windowSeconds: 60 },
  writeGlobal: { max: 120, windowSeconds: 60 },
  writeClient: { max: 15, windowSeconds: 60 },
} as const;

/** Short non-reversible tag for the client address so raw IPs are never stored. */
export async function clientTag(ip: string | null | undefined): Promise<string> {
  const v = (ip ?? "").trim().slice(0, 64) || "unknown";
  const data = new TextEncoder().encode(`bb-rl:${v}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function rulesFor(kind: "external" | "intl" | "write", tag: string): LimitRule[] {
  const ext = kind !== "write";
  const g = ext ? LIMITS.externalGlobal : LIMITS.writeGlobal;
  const c = ext ? LIMITS.externalClient : LIMITS.writeClient;
  return [
    { bucket: `${kind}:global`, ...g },
    { bucket: `${kind}:c:${tag}`, ...c },
  ];
}

/**
 * True when every rule allows the request. If the counter store fails, the request is
 * denied (fail closed) so callers fall back to cached/local results.
 */
export async function allowed(rules: LimitRule[], hit: HitFn): Promise<boolean> {
  try {
    for (const r of rules) if (!(await hit(r))) return false;
    return true;
  } catch {
    return false;
  }
}
