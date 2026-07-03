import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { processInteraction } from '@/services/interactionService';
import { processPayloadSchema } from '@/validators/schemas';

export const dynamic = 'force-dynamic';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

export async function POST(req: NextRequest) {
  try {
    // 1. Verify QStash signature (not Discord's — this route is QStash-invoked)
    const rawBody = await req.text();
    const signature = req.headers.get('upstash-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing QStash signature' }, { status: 401 });
    }

    try {
      await receiver.verify({
        signature,
        body: rawBody,
      });
    } catch {
      return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
    }

    // 2. Parse and validate payload
    const body = JSON.parse(rawBody);
    const { interactionId } = processPayloadSchema.parse(body);

    // 3. Process the interaction
    await processInteraction(interactionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Process endpoint error:', error);
    // Return non-2xx so QStash retries
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    );
  }
}
