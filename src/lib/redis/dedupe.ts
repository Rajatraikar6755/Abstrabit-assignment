import { getRedis } from './client';

const DEDUP_PREFIX = 'interaction:';
const DEDUP_TTL_SECONDS = 86400; // 24 hours

/**
 * Check if an interaction has already been processed.
 * Uses Redis SET NX (set-if-not-exists) to atomically check and claim.
 * Returns true if this is the first time seeing this interaction (i.e., not a dupe).
 * Returns false if it's a duplicate.
 */
export async function claimInteraction(interactionId: string): Promise<boolean> {
  const redis = getRedis();
  const key = `${DEDUP_PREFIX}${interactionId}`;
  
  // SET NX returns "OK" if key was set (first time), null if already existed
  const result = await redis.set(key, '1', {
    nx: true,
    ex: DEDUP_TTL_SECONDS,
  });
  
  return result === 'OK';
}
