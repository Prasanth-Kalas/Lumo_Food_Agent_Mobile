/**
 * Per-device Lumo session id.
 *
 * We persist a random opaque id in AsyncStorage and forward it to the
 * backend on every /api/chat request. That's the key the backend uses to
 * look up cart state, order history, and the Stripe PaymentIntent in
 * Postgres — so it MUST be stable across cold starts; otherwise every
 * restart orphans the user's cart.
 *
 * Why not a real auth identity:
 *   The MVP has no login. This id is a cookie substitute — adequate for
 *   keeping a single user's data coherent on one device, inadequate for
 *   multi-device or account-recovery scenarios. Swap for a real user id
 *   the moment we add login.
 *
 * Generation:
 *   We prefer globalThis.crypto.randomUUID() (Hermes + recent iOS/Android
 *   RN expose it). If unavailable, fall back to a 128-bit time+random hex
 *   string — good enough for a session key, not trying to be cryptographic.
 *
 * Storage key is prefixed `lumo:` to stay out of other libraries' way.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "lumo:sessionId";

let cached: string | null = null;
let inFlight: Promise<string> | null = null;

/**
 * Resolve the device's sessionId. Returns the cached value immediately on
 * warm calls; on the first call per app launch, reads AsyncStorage and (if
 * absent) generates + persists a fresh id. Concurrent callers share the
 * same promise so we never write two ids.
 */
export function getOrCreateSessionId(): Promise<string> {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      if (existing && isPlausible(existing)) {
        cached = existing;
        return existing;
      }
    } catch {
      // First install, corrupted storage, or permissions glitch — fall through
      // and mint a new id. Writing may also fail; that's fine because we'll
      // keep using the in-memory `cached` value for this process lifetime.
    }

    const fresh = generate();
    cached = fresh;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, fresh);
    } catch {
      // Non-fatal.
    }
    return fresh;
  })();

  // Clear in-flight so failures don't poison subsequent calls; the next
  // caller will retry generation from scratch.
  inFlight.finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/**
 * Synchronous cached read. Returns null before `getOrCreateSessionId()`
 * has resolved at least once in this process. Useful for UI that wants to
 * render a debug badge without blocking.
 */
export function peekSessionId(): string | null {
  return cached;
}

/** Wipe the id (only for dev/support/test tooling). Not used in prod UX. */
export async function resetSessionId(): Promise<void> {
  cached = null;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// --- internals -------------------------------------------------------------

function isPlausible(s: string): boolean {
  // Same charset the backend sanitizer accepts. Reject anything older /
  // corrupted so we re-mint cleanly.
  return /^[A-Za-z0-9._:-]{8,128}$/.test(s);
}

function generate(): string {
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID && typeof g.crypto.randomUUID === "function") {
    try {
      return String(g.crypto.randomUUID());
    } catch {
      // Fall through to the manual generator.
    }
  }
  // 128 bits of time+random, hex-encoded. Not crypto-secure — doesn't need
  // to be. Prefix with `m` so we can tell device-minted ids apart from
  // UUIDs and the literal "demo" in logs.
  const rand = Math.random().toString(16).slice(2, 10);
  const rand2 = Math.random().toString(16).slice(2, 10);
  const t = Date.now().toString(16);
  return `m-${t}-${rand}${rand2}`;
}
