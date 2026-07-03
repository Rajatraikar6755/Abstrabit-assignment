import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { Interaction } from '@/models/Interaction';
import { publishToQueue } from '@/lib/queue/qstash';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await connectDB();

  const interaction = await Interaction.findById(id);
  if (!interaction) {
    return NextResponse.json({ error: 'Interaction not found' }, { status: 404 });
  }

  if (interaction.status === 'success') {
    return NextResponse.json({ error: 'Already succeeded' }, { status: 400 });
  }

  try {
    // Reset status and republish to QStash
    interaction.status = 'deferred';
    await interaction.save();

    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const messageId = await publishToQueue(
      `${appUrl}/api/discord/process`,
      { interactionId: interaction.discordInteractionId },
      { retries: 3 }
    );

    interaction.qstashMessageId = messageId;
    await interaction.save();

    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    console.error('Retry failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Retry failed' },
      { status: 500 }
    );
  }
}
