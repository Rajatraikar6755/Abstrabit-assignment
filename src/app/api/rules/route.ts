import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { CommandConfig } from '@/models/CommandConfig';
import { commandConfigUpdateSchema } from '@/validators/schemas';

export const dynamic = 'force-dynamic';

// GET all command configs
export async function GET() {
  await connectDB();
  const configs = await CommandConfig.find({}).sort({ commandName: 1 }).lean();
  return NextResponse.json({ configs });
}

// PUT update a specific command config
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...updateData } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing config id' }, { status: 400 });
  }

  const validated = commandConfigUpdateSchema.safeParse(updateData);
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.issues }, { status: 400 });
  }

  await connectDB();

  const config = await CommandConfig.findByIdAndUpdate(
    id,
    { $set: validated.data },
    { new: true }
  );

  if (!config) {
    return NextResponse.json({ error: 'Config not found' }, { status: 404 });
  }

  return NextResponse.json({ config });
}
