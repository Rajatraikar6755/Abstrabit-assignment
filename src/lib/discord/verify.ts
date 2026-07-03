import nacl from 'tweetnacl';

/**
 * Verify Discord's Ed25519 signature on an interaction request.
 * Returns true if valid, false if forged/invalid.
 */
export function verifyDiscordSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  publicKey: string
): boolean {
  try {
    const message = Buffer.from(timestamp + rawBody);
    const sig = Buffer.from(signature, 'hex');
    const key = Buffer.from(publicKey, 'hex');

    return nacl.sign.detached.verify(
      new Uint8Array(message),
      new Uint8Array(sig),
      new Uint8Array(key)
    );
  } catch {
    return false;
  }
}

/**
 * Check if timestamp is within acceptable freshness window (5 minutes).
 * Prevents replay attacks.
 */
export function isTimestampFresh(timestamp: string, maxAgeSeconds = 300): boolean {
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime)) return false;
  
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - requestTime) <= maxAgeSeconds;
}
