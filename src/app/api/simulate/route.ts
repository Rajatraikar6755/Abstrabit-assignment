import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { Interaction } from '@/models/Interaction';
import { GuildConfig } from '@/models/GuildConfig';
import { CommandConfig } from '@/models/CommandConfig';
import { evaluateRules } from '@/services/ruleEngine';
import { triageReport } from '@/lib/ai/gemini';

export const dynamic = 'force-dynamic';

/**
 * POST /api/simulate
 * Simulates a Discord slash command through the full processing pipeline
 * (DB persistence → rule engine → AI triage) without requiring Discord
 * signature verification or QStash. Intended for dashboard use only.
 *
 * Body: { command: "report" | "status", text?: string, username?: string, guildId?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const command = String(body.command || 'report').toLowerCase();
    const text = String(body.text || '').slice(0, 2000);
    const username = String(body.username || 'dashboard-user').slice(0, 80);
    const guildId = String(body.guildId || 'simulate-guild');

    if (!['report', 'status'].includes(command)) {
      return NextResponse.json({ error: 'Only /report and /status are supported' }, { status: 400 });
    }

    await connectDB();

    // Synthetic interaction ID so dedup/retry UI works
    const interactionId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Persist a real interaction record so it appears in logs
    const interaction = await Interaction.create({
      discordInteractionId: interactionId,
      guildId,
      channelId: 'simulate-channel',
      command,
      commandOptions: { text, source: 'dashboard-simulator' },
      username,
      userId: 'dashboard-simulator',
      rawPayload: { simulated: true, command, text },
      status: 'processing',
      interactionToken: 'simulated',
    });

    const startTime = Date.now();
    let triageResult = null;
    let ruleResults = { matched: false, matchedRules: [], appliedActions: [], tags: [], priority: 'normal', autoReply: '' };

    // Load guild + command config for rule engine
    const [guildConfig, commandConfig] = await Promise.all([
      GuildConfig.findOne({ discordGuildId: guildId }),
      CommandConfig.findOne({ commandName: command, guildId }),
    ]);

    // Run rule engine
    ruleResults = evaluateRules(text, commandConfig);

    // Run AI triage for /report
    if (command === 'report' && text && guildConfig?.aiEnabled !== false) {
      try {
        triageResult = await triageReport(text, username);
      } catch (aiErr) {
        console.error('Simulate: AI triage failed (non-fatal):', aiErr);
      }
    }

    // Build embed preview (mirrors interactionService.ts logic)
    const priorityColors: Record<string, number> = {
      critical: 0xFF0000,
      high: 0xFF8C00,
      medium: 0xFFD700,
      low: 0x00FF00,
      normal: 0x06B6D4,
    };
    const priority = triageResult?.priority || ruleResults.priority || 'normal';
    const embedColor = priorityColors[priority] ?? 0x06B6D4;

    const embedFields: { name: string; value: string; inline?: boolean }[] = [
      { name: 'Content', value: text || 'No content provided' },
    ];

    if (triageResult) {
      embedFields.push(
        { name: '🤖 AI Summary', value: triageResult.summary },
        { name: '🏷️ Tags', value: triageResult.tags.map((t: string) => `\`${t}\``).join(' ') || 'None', inline: true },
        { name: '🔴 Priority', value: triageResult.priority.toUpperCase(), inline: true },
        { name: '💡 Suggested Action', value: triageResult.suggestedAction }
      );
    }

    if (ruleResults.matched && ruleResults.tags.length > 0) {
      embedFields.push({ name: '📌 Rule Tags', value: ruleResults.tags.map((t: string) => `\`${t}\``).join(' '), inline: true });
    }

    if (ruleResults.autoReply) {
      embedFields.push({ name: '💬 Auto-Reply Triggered', value: ruleResults.autoReply });
    }

    // Mark success
    interaction.status = 'success';
    interaction.aiSummary = triageResult?.summary || '';
    interaction.aiTags = triageResult?.tags || [];
    interaction.aiPriority = triageResult?.priority || 'medium';
    interaction.ruleResults = ruleResults;
    interaction.discordResponseSent = false; // simulated — no real Discord token
    interaction.mirrorSent = false;
    interaction.attempts = [{
      attemptNumber: 1,
      status: 'success',
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    }];
    await interaction.save();

    return NextResponse.json({
      success: true,
      interactionId,
      durationMs: Date.now() - startTime,
      embed: {
        title: command === 'report' ? '📋 Report Received' : '📊 Status',
        color: embedColor,
        fields: embedFields,
        timestamp: new Date().toISOString(),
        footer: { text: `Simulated · ID: ${interactionId}` },
      },
      ruleResults,
      triageResult,
      priority,
      tags: [...(ruleResults.tags || []), ...(triageResult?.tags || [])].filter((v, i, a) => a.indexOf(v) === i),
    });
  } catch (error) {
    console.error('Simulate endpoint error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Simulation failed' },
      { status: 500 }
    );
  }
}
