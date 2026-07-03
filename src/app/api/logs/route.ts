import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { Interaction } from '@/models/Interaction';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {

  await connectDB();

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const status = url.searchParams.get('status');
  const command = url.searchParams.get('command');
  const search = url.searchParams.get('search');

  const filter: Record<string, unknown> = {};
  if (status && status !== 'all') filter.status = status;
  if (command && command !== 'all') filter.command = command;
  if (search) {
    filter.$or = [
      { username: { $regex: search, $options: 'i' } },
      { command: { $regex: search, $options: 'i' } },
      { aiSummary: { $regex: search, $options: 'i' } },
    ];
  }

  const [logs, total] = await Promise.all([
    Interaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-rawPayload -interactionToken')
      .lean(),
    Interaction.countDocuments(filter),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
