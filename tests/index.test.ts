import test from 'node:test';
import assert from 'node:assert/strict';
import { SlidingWindow, TokenBucket } from '../src/index.js';

test('token bucket consumes capacity, rejects excess and reports refill delay', () => {
  let now = 0;
  const bucket = new TokenBucket({
    capacity: 2,
    refillRate: 1,
    refillIntervalMs: 1_000,
    clock: () => now,
  });
  assert.deepEqual(bucket.take(), { allowed: true, remaining: 1, resetAt: 1_000, retryAfterMs: 0 });
  assert.equal(bucket.take().allowed, true);
  assert.deepEqual(bucket.take(), {
    allowed: false,
    remaining: 0,
    resetAt: 2_000,
    retryAfterMs: 1_000,
  });
  now = 500;
  assert.equal(bucket.take().allowed, false);
  now = 1_000;
  assert.equal(bucket.take().allowed, true);
  assert.equal(bucket.take(2).allowed, false);
  assert.throws(() => bucket.take(3), RangeError);
});

test('token bucket caps refill, handles backward clocks, and validates inputs', () => {
  let now = 0;
  const bucket = new TokenBucket({ capacity: 2, refillRate: 1, clock: () => now });
  bucket.take(2);
  now = 10_000;
  assert.equal(bucket.take(2).allowed, true);
  now = 1;
  assert.equal(bucket.take(1).allowed, false);
  assert.throws(() => bucket.take(0), RangeError);
  assert.throws(() => new TokenBucket({ capacity: 1, refillRate: 0 }), RangeError);
  assert.throws(
    () => new TokenBucket({ capacity: 1, refillRate: 1, clock: () => NaN }).take(),
    RangeError,
  );
});

test('sliding window expires inclusive boundary and resets oldest active request', () => {
  let now = 0;
  const limiter = new SlidingWindow({ limit: 2, windowMs: 1_000, clock: () => now });
  assert.equal(limiter.take().remaining, 1);
  assert.equal(limiter.take().remaining, 0);
  const blocked = limiter.take();
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 1_000);
  assert.equal(limiter.size, 2);
  now = 1_000;
  assert.deepEqual(limiter.take(), {
    allowed: true,
    remaining: 1,
    resetAt: 2_000,
    retryAfterMs: 0,
  });
});

test('sliding window validates limits and supports clock rollback without losing entries', () => {
  let now = 50;
  const limiter = new SlidingWindow({ limit: 1, windowMs: 10, clock: () => now });
  assert.equal(limiter.take().allowed, true);
  now = 40;
  assert.equal(limiter.take().allowed, false);
  assert.throws(() => new SlidingWindow({ limit: 1.5, windowMs: 2 }), RangeError);
  assert.throws(() => new SlidingWindow({ limit: 1, windowMs: 0 }), RangeError);
});

test('sliding window prunes expired requests even after timestamps arrive out of order', () => {
  let now = 1_000;
  const limiter = new SlidingWindow({ limit: 2, windowMs: 1_000, clock: () => now });
  assert.equal(limiter.take().allowed, true);
  now = 100;
  assert.equal(limiter.take().allowed, true);
  now = 1_100;
  assert.equal(limiter.size, 1);
  assert.equal(limiter.take().allowed, true);
});
