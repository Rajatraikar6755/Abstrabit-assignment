import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from './client';

let rateLimiter: Ratelimit | null = null;

/**
 * Sliding-window rate limiter for the interactions endpoint.
 * 30 requests per 10 seconds per guild — generous enough for normal use,
 * tight enough to blunt abuse.
 */
export function getRateLimiter(): Ratelimit {
  if (!rateLimiter) {
    rateLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(30, '10 s'),
      prefix: 'ratelimit:interactions',
    });
  }
  return rateLimiter;
}
