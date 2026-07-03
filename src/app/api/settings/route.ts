import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { GuildConfig } from '@/models/GuildConfig';
import { guildConfigUpdateSchema } from '@/validators/schemas';
import { encrypt } from '@/lib/security/encryption';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connectDB();
  const configs = await GuildConfig.find({}).lean();

  // Strip encrypted webhook URL — never expose to client
  const sanitized = configs.map(c => ({
    ...c,
    mirrorWebhookUrlEncrypted: undefined,
    hasMirrorWebhook: !!(c as Record<string, unknown>).mirrorWebhookUrlEncrypted,
  }));

  return NextResponse.json({ configs: sanitized });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { guildId, ...updateData } = body;

  if (!guildId) {
    return NextResponse.json({ error: 'Missing guildId' }, { status: 400 });
  }

  const validated = guildConfigUpdateSchema.safeParse(updateData);
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.issues }, { status: 400 });
  }

  await connectDB();

  const update: Record<string, unknown> = {};
  if (validated.data.channelId !== undefined) update.channelId = validated.data.channelId;
  if (validated.data.mirrorType !== undefined) update.mirrorType = validated.data.mirrorType;
  if (validated.data.aiEnabled !== undefined) update.aiEnabled = validated.data.aiEnabled;

  // Encrypt mirror webhook URL before storing
  if (validated.data.mirrorWebhookUrl !== undefined) {
    if (validated.data.mirrorWebhookUrl === '') {
      update.mirrorWebhookUrlEncrypted = '';
    } else {
      update.mirrorWebhookUrlEncrypted = encrypt(validated.data.mirrorWebhookUrl);
    }
  }

  const config = await GuildConfig.findOneAndUpdate(
    { discordGuildId: guildId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json({
    config: {
      ...config.toObject(),
      mirrorWebhookUrlEncrypted: undefined,
      hasMirrorWebhook: !!config.mirrorWebhookUrlEncrypted,
    },
  });
}
