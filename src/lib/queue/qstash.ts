import { Client } from '@upstash/qstash';

let qstashClient: Client | null = null;

export function getQStash(): Client {
  if (!qstashClient) {
    if (!process.env.QSTASH_TOKEN) {
      throw new Error('QSTASH_TOKEN environment variable is not set');
    }
    qstashClient = new Client({
      token: process.env.QSTASH_TOKEN,
    });
  }
  return qstashClient;
}

/**
 * Publish a message to QStash for async processing.
 * QStash will POST to the target URL with automatic retries.
 */
export async function publishToQueue(
  targetUrl: string,
  body: Record<string, unknown>,
  options?: {
    retries?: number;
    delay?: string; // e.g., "5s"
  }
): Promise<string> {
  const client = getQStash();
  
  const result = await client.publishJSON({
    url: targetUrl,
    body,
    retries: options?.retries ?? 3,
    delay: options?.delay as any,
    headers: {
      'Bypass-Tunnel-Reminder': 'true',
      'bypass-tunnel-reminder': 'true',
    },
  });

  return result.messageId;
}
