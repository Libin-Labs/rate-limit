import rateLimit = require('@lp-labs/rate-limit');

const bucket = new rateLimit.TokenBucket({ capacity: 2, refillRate: 1 });
const window = new rateLimit.SlidingWindow({ limit: 4, windowMs: 100 });
void [bucket.take().remaining, window.size];
