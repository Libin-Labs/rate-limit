export type Clock = () => number;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
}

export interface TokenBucketOptions {
  capacity: number;
  refillRate: number;
  refillIntervalMs?: number;
  clock?: Clock;
}

export interface SlidingWindowOptions {
  limit: number;
  windowMs: number;
  clock?: Clock;
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${name} must be a positive finite number`);
}

export class TokenBucket {
  private tokens: number;
  private lastRefillAt: number;
  private readonly clock: Clock;
  private readonly refillPerMs: number;
  private readonly capacity: number;

  constructor(options: TokenBucketOptions) {
    assertPositive(options.capacity, 'capacity');
    assertPositive(options.refillRate, 'refillRate');
    const interval = options.refillIntervalMs ?? 1_000;
    assertPositive(interval, 'refillIntervalMs');
    this.capacity = options.capacity;
    this.refillPerMs = options.refillRate / interval;
    this.clock = options.clock ?? Date.now;
    this.lastRefillAt = this.now();
    this.tokens = this.capacity;
  }

  take(amount = 1): RateLimitResult {
    assertPositive(amount, 'amount');
    if (amount > this.capacity) throw new RangeError('amount cannot exceed bucket capacity');
    const now = this.now();
    const elapsed = now - this.lastRefillAt;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
      this.lastRefillAt = now;
    }
    const allowed = amount <= this.tokens;
    if (allowed) this.tokens -= amount;
    const missing = Math.max(0, amount - this.tokens);
    const retryAfterMs = allowed ? 0 : missing / this.refillPerMs;
    return {
      allowed,
      remaining: Math.floor(this.tokens * 1_000_000) / 1_000_000,
      resetAt: now + (this.capacity - this.tokens) / this.refillPerMs,
      retryAfterMs,
    };
  }

  private now(): number {
    const value = this.clock();
    if (!Number.isFinite(value)) throw new RangeError('clock must return a finite timestamp');
    return value;
  }
}

export class SlidingWindow {
  private timestamps: number[] = [];
  private readonly clock: Clock;
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(options: SlidingWindowOptions) {
    assertPositive(options.limit, 'limit');
    if (!Number.isInteger(options.limit)) throw new RangeError('limit must be an integer');
    assertPositive(options.windowMs, 'windowMs');
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.clock = options.clock ?? Date.now;
  }

  take(): RateLimitResult {
    const now = this.clock();
    if (!Number.isFinite(now)) throw new RangeError('clock must return a finite timestamp');
    const cutoff = now - this.windowMs;
    this.timestamps = this.timestamps.filter((timestamp) => timestamp > cutoff);
    const allowed = this.timestamps.length < this.limit;
    if (allowed) this.timestamps.push(now);
    const oldest = this.timestamps.reduce(
      (minimum, timestamp) => Math.min(minimum, timestamp),
      Number.POSITIVE_INFINITY,
    );
    const resetAt =
      oldest === Number.POSITIVE_INFINITY ? now + this.windowMs : oldest + this.windowMs;
    return {
      allowed,
      remaining: Math.max(0, this.limit - this.timestamps.length),
      resetAt,
      retryAfterMs: allowed ? 0 : Math.max(0, resetAt - now),
    };
  }

  get size(): number {
    const now = this.clock();
    if (!Number.isFinite(now)) throw new RangeError('clock must return a finite timestamp');
    const cutoff = now - this.windowMs;
    this.timestamps = this.timestamps.filter((timestamp) => timestamp > cutoff);
    return this.timestamps.length;
  }
}
