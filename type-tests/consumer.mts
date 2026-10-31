import { SlidingWindow, TokenBucket, type RateLimitResult } from '@lp-labs/rate-limit';

const result: RateLimitResult = new TokenBucket({ capacity: 5, refillRate: 1 }).take();
const window = new SlidingWindow({ limit: 3, windowMs: 1_000 });
// @ts-expect-error Limit is numeric.
new SlidingWindow({ limit: 'three', windowMs: 1_000 });
void [result.allowed, window.take().resetAt];
