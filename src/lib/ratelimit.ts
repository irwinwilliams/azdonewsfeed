/**
 * Client-side rate limiting utility for API requests
 * Prevents excessive API calls that could abuse Azure DevOps or cause performance issues
 */

type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

type RequestLog = {
  timestamp: number;
  count: number;
};

class RateLimiter {
  private requests: Map<string, RequestLog[]> = new Map();

  constructor(private config: RateLimitConfig) {}

  /**
   * Check if a request is allowed under the rate limit
   * @param key - Unique identifier for the rate limit bucket (e.g., "feed-refresh")
   * @returns true if request is allowed, false if rate limited
   */
  check(key: string): boolean {
    const now = Date.now();
    const logs = this.requests.get(key) || [];

    // Remove expired entries
    const validLogs = logs.filter((log) => now - log.timestamp < this.config.windowMs);

    // Count total requests in window
    const totalRequests = validLogs.reduce((sum, log) => sum + log.count, 0);

    if (totalRequests >= this.config.maxRequests) {
      return false;
    }

    // Add new request
    validLogs.push({ timestamp: now, count: 1 });
    this.requests.set(key, validLogs);

    return true;
  }

  /**
   * Get time until next request is allowed
   * @param key - Unique identifier for the rate limit bucket
   * @returns milliseconds until rate limit resets, or 0 if not rate limited
   */
  getTimeUntilReset(key: string): number {
    const now = Date.now();
    const logs = this.requests.get(key) || [];
    const validLogs = logs.filter((log) => now - log.timestamp < this.config.windowMs);

    if (validLogs.length === 0) {
      return 0;
    }

    const oldestLog = validLogs[0];
    if (!oldestLog) return 0;

    const resetTime = oldestLog.timestamp + this.config.windowMs;
    return Math.max(0, resetTime - now);
  }

  /**
   * Clear rate limit for a specific key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limits
   */
  resetAll(): void {
    this.requests.clear();
  }
}

// Global rate limiters for different operations
export const feedRateLimiter = new RateLimiter({
  maxRequests: 10, // 10 requests
  windowMs: 60 * 1000, // per minute
});

export const projectsRateLimiter = new RateLimiter({
  maxRequests: 20, // 20 requests
  windowMs: 60 * 1000, // per minute
});

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfterMs: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}
