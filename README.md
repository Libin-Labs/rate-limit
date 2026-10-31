# @lp-labs/rate-limit

In-memory single-process token-bucket and sliding-window limiters with an injectable clock.

```ts
import { TokenBucket } from "@lp-labs/rate-limit";

const apiLimit = new TokenBucket({ capacity: 10, refillRate: 2, refillIntervalMs: 1_000 });
const result = apiLimit.take();
if (!result.allowed) console.log(`Try again in ${result.retryAfterMs}ms`);
```

## API

- `Clock` is `() => number`, returning a finite timestamp in milliseconds.
- `RateLimitResult` is `{ allowed: boolean; remaining: number; resetAt: number; retryAfterMs: number }`. `resetAt` is the predicted time at which the relevant allowance resets; `retryAfterMs` is zero when allowed.
- `TokenBucketOptions`: required positive finite `capacity` (initial token count, may be fractional), positive finite `refillRate`, optional positive finite `refillIntervalMs` (default `1000`, the interval in which the rate is supplied), and optional `clock` (default `Date.now`).
- `new TokenBucket(options)` starts full. `take(amount = 1)` requires a positive finite amount; it consumes only when enough tokens exist, refills continuously up to capacity, and returns `RateLimitResult`. Failed takes do not consume tokens.
- `SlidingWindowOptions`: positive integer `limit`, positive finite `windowMs`, and optional `clock`.
- `new SlidingWindow(options)` creates an empty request history. `take()` records one request if allowed, and returns `RateLimitResult`; requests at or before `now - windowMs` expire. `size` reports currently retained request timestamps.

The algorithms are local to the current process; instances do not coordinate across workers, servers, restarts, or machines. A clock moving backward does not create token refill; sliding-window history remains until the clock reaches its expiry boundary. Invalid configuration, invalid take amount, or a non-finite clock result throws `RangeError`. Sliding-window storage is proportional to the active requests up to `limit`.

## Compatibility and references

Targets ES2022 and has no runtime dependencies. See [token bucket](https://en.wikipedia.org/wiki/Token_bucket) and [sliding window](https://en.wikipedia.org/wiki/Sliding_window_protocol).

## License

[MIT](./LICENSE).

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
