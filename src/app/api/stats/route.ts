import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { Interaction } from '@/models/Interaction';

export const dynamic = 'force-dynamic';

export async function GET() {

  await connectDB();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [
    totalAll,
    totalToday,
    successToday,
    failedToday,
    processingToday,
    commandBreakdown,
    recentFailures,
    hourlyData,
  ] = await Promise.all([
    Interaction.countDocuments({}),
    Interaction.countDocuments({ createdAt: { $gte: todayStart } }),
    Interaction.countDocuments({ status: 'success', createdAt: { $gte: todayStart } }),
    Interaction.countDocuments({ status: 'failed', createdAt: { $gte: todayStart } }),
    Interaction.countDocuments({ status: { $in: ['processing', 'deferred'] }, createdAt: { $gte: todayStart } }),
    Interaction.aggregate([
      { $match: { createdAt: { $gte: weekStart } } },
      { $group: { _id: '$command', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Interaction.find({ status: 'failed' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('command username createdAt attempts')
      .lean(),
    Interaction.aggregate([
      { $match: { createdAt: { $gte: todayStart } } },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          total: { $sum: 1 },
          success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const successRate = totalToday > 0 ? successToday / totalToday : 1;

  return NextResponse.json({
    totalAll,
    totalToday,
    successToday,
    failedToday,
    processingToday,
    successRate,
    commandBreakdown: commandBreakdown.map(c => ({ command: c._id, count: c.count })),
    recentFailures,
    hourlyData: hourlyData.map(h => ({
      hour: h._id,
      total: h.total,
      success: h.success,
      failed: h.failed,
    })),
  });
}
