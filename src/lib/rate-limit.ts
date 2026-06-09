interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

interface RateLimitOptions {
  /** Maximum number of requests allowed in the window. Default: 100 */
  maxRequests?: number;
  /** Time window in milliseconds. Default: 60000 (1 minute) */
  windowMs?: number;
}

interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Seconds until the rate limit resets */
  retryAfter: number;
}

/**
 * Simple in-memory rate limiter per tenant.
 * Returns 429 information when limit is exceeded.
 *
 * @param tenantId - The tenant identifier to rate limit
 * @param options - Rate limiting options
 * @returns RateLimitResult with allowed status and retry info
 */
export function rateLimit(
  tenantId: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const { maxRequests = 100, windowMs = 60000 } = options;
  const now = Date.now();

  // Periodic cleanup
  cleanup();

  const entry = store.get(tenantId);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(tenantId, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 };
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  entry.count++;
  const remaining = maxRequests - entry.count;
  return { allowed: true, remaining, retryAfter: 0 };
}

/**
 * Creates a NextResponse with 429 status and Retry-After header.
 * Use this in route handlers when rate limit is exceeded.
 */
export function rateLimitResponse(retryAfter: number) {
  return new Response(
    JSON.stringify({ error: "Demasiadas solicitudes. Intenta de nuevo más tarde." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}
