import { connectDB } from '@/lib/db/connect';
import { Interaction, IInteraction } from '@/models/Interaction';
import { GuildConfig } from '@/models/GuildConfig';
import { CommandConfig } from '@/models/CommandConfig';
import { evaluateRules } from '@/services/ruleEngine';
import { sendMirrorNotification } from '@/services/mirrorService';
import { triageReport } from '@/lib/ai/gemini';
import { editOriginalInteractionResponse } from '@/lib/discord/client';
import { DiscordEmbed } from '@/lib/discord/types';

/**
 * Process a deferred interaction asynchronously.
 * Called by QStash after the initial deferred acknowledgment.
 */
export async function processInteraction(interactionId: string): Promise<void> {
  await connectDB();

  const interaction = await Interaction.findOne({ discordInteractionId: interactionId });
  if (!interaction) {
    throw new Error(`Interaction ${interactionId} not found`);
  }

  if (interaction.status === 'success') {
    // Already processed (idempotent)
    return;
  }

  const attemptNumber = (interaction.attempts?.length || 0) + 1;
  const startTime = Date.now();

  try {
    interaction.status = 'processing';
    await interaction.save();

    // Load guild config
    const guildConfig = await GuildConfig.findOne({ discordGuildId: interaction.guildId });

    // Load command config
    const commandConfig = await CommandConfig.findOne({
      commandName: interaction.command,
      guildId: interaction.guildId,
    });

    // Run rule engine
    const ruleResults = evaluateRules(
      getInputText(interaction),
      commandConfig
    );
    interaction.ruleResults = ruleResults;

    // AI triage for /report and /suggest commands
    let triageResult = null;
    if ((interaction.command === 'report' || interaction.command === 'suggest') && guildConfig?.aiEnabled !== false) {
      try {
        // Fetch recent reports/suggestions for context (lightweight RAG)
        const recentReports = await Interaction.find({
          command: interaction.command,
          guildId: interaction.guildId,
          status: 'success',
          aiSummary: { $ne: '' },
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('aiSummary')
          .lean();

        triageResult = await triageReport(
          getInputText(interaction),
          interaction.username,
          { recentReports: recentReports.map(r => (r as { aiSummary: string }).aiSummary).filter(Boolean) }
        );

        interaction.aiSummary = triageResult.summary;
        interaction.aiTags = triageResult.tags;
        interaction.aiPriority = triageResult.priority;
      } catch (aiError) {
        console.error('AI triage error (non-fatal):', aiError);
        // Continue without AI — never let AI failure block the response
      }
    }

    // Build Discord follow-up response
    const embeds = buildResponseEmbeds(interaction, ruleResults, triageResult);
    const components = buildResponseComponents(interaction);

    // Edit the deferred response in Discord
    await editOriginalInteractionResponse(
      process.env.DISCORD_APPLICATION_ID!,
      interaction.interactionToken,
      '',
      embeds,
      components
    );
    interaction.discordResponseSent = true;

    // Mirror notification
    if (guildConfig?.mirrorWebhookUrlEncrypted) {
      try {
        await sendMirrorNotification(
          guildConfig.mirrorWebhookUrlEncrypted,
          guildConfig.mirrorType || 'discord',
          {
            command: interaction.command,
            username: interaction.username,
            guildName: guildConfig.guildName || interaction.guildId,
            text: getInputText(interaction),
            aiSummary: interaction.aiSummary,
            aiTags: interaction.aiTags,
            aiPriority: interaction.aiPriority,
            timestamp: new Date().toISOString(),
          }
        );
        interaction.mirrorSent = true;
      } catch (mirrorError) {
        // Log but don't fail the whole interaction — mirror is best-effort per attempt
        console.error('Mirror notification error:', mirrorError);
        throw mirrorError; // Re-throw so QStash retries
      }
    } else {
      interaction.mirrorSent = true; // No mirror configured — mark as sent
    }

    // Success
    interaction.status = 'success';
    interaction.attempts.push({
      attemptNumber,
      status: 'success',
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    });
    await interaction.save();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    interaction.status = 'failed';
    interaction.attempts.push({
      attemptNumber,
      status: 'failed',
      error: errorMessage.slice(0, 500),
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    });
    await interaction.save();

    // Re-throw so QStash knows to retry
    throw error;
  }
}

function getInputText(interaction: IInteraction): string {
  const options = interaction.commandOptions as Record<string, unknown>;
  if (options?.text) return String(options.text);
  if (options?.message) return String(options.message);
  return '';
}

function buildResponseEmbeds(
  interaction: IInteraction,
  ruleResults: ReturnType<typeof evaluateRules>,
  triageResult: { summary: string; tags: string[]; priority: string; suggestedAction: string } | null
): DiscordEmbed[] {
  const isSuggestion = interaction.command === 'suggest';
  const embed: DiscordEmbed = {
    title: isSuggestion ? `💡 Suggestion Received` : `📋 Report Received`,
    color: getPriorityColor(triageResult?.priority || ruleResults.priority),
    fields: [
      { name: 'Content', value: getInputText(interaction).slice(0, 1024) || 'No content' },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: `ID: ${interaction.discordInteractionId}` },
  };

  if (triageResult) {
    embed.fields!.push(
      { name: '🤖 AI Summary', value: triageResult.summary },
      { name: '🏷️ Tags', value: triageResult.tags.map(t => `\`${t}\``).join(' ') || 'None', inline: true },
      { name: '🔴 Priority', value: triageResult.priority.toUpperCase(), inline: true },
      { name: '💡 Suggested Action', value: triageResult.suggestedAction }
    );
  }

  if (ruleResults.matched && ruleResults.tags.length > 0) {
    embed.fields!.push({
      name: '📌 Rule Tags',
      value: ruleResults.tags.map(t => `\`${t}\``).join(' '),
      inline: true,
    });
  }

  if (ruleResults.autoReply) {
    embed.fields!.push({ name: '💬 Auto-Reply', value: ruleResults.autoReply });
  }

  return [embed];
}

function buildResponseComponents(interaction: IInteraction): unknown[] {
  // Add interactive buttons (stretch goal: MESSAGE_COMPONENT handling)
  return [
    {
      type: 1, // ACTION_ROW
      components: [
        {
          type: 2, // BUTTON
          style: 3, // SUCCESS
          label: '✅ Acknowledge',
          custom_id: `ack_${interaction.discordInteractionId}`,
        },
        {
          type: 2,
          style: 4, // DANGER
          label: '🔴 Escalate',
          custom_id: `escalate_${interaction.discordInteractionId}`,
        },
        {
          type: 2,
          style: 2, // SECONDARY
          label: '📝 Add Note',
          custom_id: `note_${interaction.discordInteractionId}`,
        },
      ],
    },
  ];
}

function getPriorityColor(priority: string): number {
  const colors: Record<string, number> = {
    critical: 0xFF0000,
    high: 0xFF8C00,
    medium: 0xFFD700,
    low: 0x00FF00,
    normal: 0x5865F2,
  };
  return colors[priority] || 0x5865F2;
}
