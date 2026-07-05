import { NextRequest, NextResponse } from 'next/server';
import { verifyDiscordSignature, isTimestampFresh } from '@/lib/discord/verify';
import { InteractionType, InteractionResponseType, ComponentType, TextInputStyle, DiscordInteraction } from '@/lib/discord/types';
import { discordInteractionSchema } from '@/validators/schemas';
import { claimInteraction } from '@/lib/redis/dedupe';
import { getRateLimiter } from '@/lib/redis/ratelimit';
import { publishToQueue } from '@/lib/queue/qstash';
import { connectDB } from '@/lib/db/connect';
import { Interaction } from '@/models/Interaction';
import { GuildConfig } from '@/models/GuildConfig';

// Disable Next.js body parsing — we need the raw body for signature verification
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Read raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('x-signature-ed25519');
    const timestamp = req.headers.get('x-signature-timestamp');

    // 2. Reject unsigned requests immediately
    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
    }

    // 3. Verify Ed25519 signature
    const publicKey = process.env.DISCORD_PUBLIC_KEY;
    if (!publicKey) {
      console.error('DISCORD_PUBLIC_KEY is not configured');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const isValid = verifyDiscordSignature(rawBody, signature, timestamp, publicKey);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 4. Timestamp freshness check (replay protection)
    if (process.env.NODE_ENV === 'production' && !isTimestampFresh(timestamp)) {
      return NextResponse.json({ error: 'Request too old' }, { status: 401 });
    }

    // 5. Parse and validate payload
    let body: DiscordInteraction;
    try {
      const parsed = JSON.parse(rawBody);
      const validated = discordInteractionSchema.parse(parsed);
      body = validated as unknown as DiscordInteraction;
    } catch (err) {
      console.error('ZOD VALIDATION FAILED:', err);
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // 6. Handle PING (type 1) — required for endpoint registration
    if (body.type === InteractionType.PING) {
      return NextResponse.json({ type: InteractionResponseType.PONG });
    }

    // 7. Rate limiting (by guild or global)
    const rateLimitKey = body.guild_id || 'global';
    const limiter = getRateLimiter();
    const { success: rateLimitOk } = await limiter.limit(rateLimitKey);
    if (!rateLimitOk) {
      return NextResponse.json(
        { type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: '⚠️ Rate limit exceeded. Please wait a moment.', flags: 64 } },
        { status: 200 } // Must return 200 to Discord even for rate-limited responses
      );
    }

    // 8. Deduplication — check if we've already seen this interaction
    const isNew = await claimInteraction(body.id);
    if (!isNew) {
      // Already processed — return a safe acknowledgment
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '✅ Already processing this request.', flags: 64 },
      });
    }

    // 9. Connect to DB and persist
    await connectDB();

    // Ensure guild config exists
    if (body.guild_id) {
      await GuildConfig.findOneAndUpdate(
        { discordGuildId: body.guild_id },
        { $setOnInsert: { discordGuildId: body.guild_id, guildName: '', aiEnabled: true } },
        { upsert: true, new: true }
      );
    }

    // 10. Handle APPLICATION_COMMAND (type 2)
    if (body.type === InteractionType.APPLICATION_COMMAND && body.data) {
      const commandName = body.data.name;
      const options: Record<string, unknown> = {};
      if (body.data.options) {
        for (const opt of body.data.options) {
          options[opt.name] = opt.value;
        }
      }

      const username = body.member?.user?.username || body.user?.username || 'unknown';
      const userId = body.member?.user?.id || body.user?.id || '';

      // Persist interaction
      const interaction = await Interaction.create({
        discordInteractionId: body.id,
        guildId: body.guild_id || '',
        channelId: body.channel_id || '',
        command: commandName,
        commandOptions: options,
        username,
        userId,
        rawPayload: JSON.parse(rawBody),
        status: 'received',
        interactionToken: body.token,
      });

      // Route by command
      if (commandName === 'status') {
        return handleStatusCommand(interaction);
      } else if (commandName === 'report') {
        return handleReportCommand(interaction, options);
      } else if (commandName === 'suggest') {
        return handleSuggestCommand(interaction, options);
      } else if (commandName === 'check-report') {
        return handleCheckReportCommand(interaction, options);
      } else if (commandName === 'help') {
        return handleHelpCommand(interaction);
      } else {
        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: `Unknown command: /${commandName}` },
        });
      }
    }

    // 11. Handle MESSAGE_COMPONENT (type 3) — button clicks
    if (body.type === InteractionType.MESSAGE_COMPONENT && body.data?.custom_id) {
      return handleComponentInteraction(body);
    }

    // 12. Handle MODAL_SUBMIT (type 5)
    if (body.type === InteractionType.MODAL_SUBMIT && body.data?.custom_id) {
      return handleModalSubmit(body);
    }

    // Fallback
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Interaction type not supported.' },
    });
  } catch (error) {
    console.error('Interactions endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * /status — respond immediately (fast path, no deferral needed)
 */
async function handleStatusCommand(interaction: InstanceType<typeof Interaction>) {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalToday, successToday, failedToday, recentCommands] = await Promise.all([
      Interaction.countDocuments({ guildId: interaction.guildId, createdAt: { $gte: todayStart } }),
      Interaction.countDocuments({ guildId: interaction.guildId, status: 'success', createdAt: { $gte: todayStart } }),
      Interaction.countDocuments({ guildId: interaction.guildId, status: 'failed', createdAt: { $gte: todayStart } }),
      Interaction.find({ guildId: interaction.guildId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('command username status createdAt')
        .lean(),
    ]);

    const successRate = totalToday > 0 ? ((successToday / totalToday) * 100).toFixed(1) : '100.0';

    interaction.status = 'success';
    interaction.discordResponseSent = true;
    interaction.mirrorSent = true;
    await interaction.save();

    const recentList = recentCommands
      .map(c => {
        const cmd = c as { command: string; username: string; status: string; createdAt: Date };
        const statusIcon = cmd.status === 'success' ? '✅' : cmd.status === 'failed' ? '❌' : '⏳';
        return `${statusIcon} \`/${cmd.command}\` by **${cmd.username}**`;
      })
      .join('\n') || 'No recent activity';

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: '📊 Bot Status',
          color: 0x5865F2,
          fields: [
            { name: 'Commands Today', value: `${totalToday}`, inline: true },
            { name: 'Success Rate', value: `${successRate}%`, inline: true },
            { name: 'Failed Today', value: `${failedToday}`, inline: true },
            { name: 'Recent Activity', value: recentList },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'Discord Bot Dashboard' },
        }],
      },
    });
  } catch (error) {
    console.error('Status command error:', error);
    interaction.status = 'failed';
    await interaction.save();

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: '❌ Failed to fetch status. Please try again.' },
    });
  }
}

/**
 * /report <text> — defer and process async via QStash.
 * Also supports opening a modal if no text option is provided.
 */
async function handleReportCommand(
  interaction: InstanceType<typeof Interaction>,
  options: Record<string, unknown>
) {
  // If no text option, open a modal form (stretch goal)
  if (!options.text) {
    return NextResponse.json({
      type: InteractionResponseType.MODAL,
      data: {
        title: '📝 Submit a Report',
        custom_id: `report_modal_${interaction.discordInteractionId}`,
        components: [
          {
            type: ComponentType.ACTION_ROW,
            components: [{
              type: ComponentType.TEXT_INPUT,
              custom_id: 'report_text',
              label: 'What would you like to report?',
              style: TextInputStyle.PARAGRAPH,
              placeholder: 'Describe the issue, bug, or suggestion...',
              required: true,
              min_length: 10,
              max_length: 2000,
            }],
          },
          {
            type: ComponentType.ACTION_ROW,
            components: [{
              type: ComponentType.TEXT_INPUT,
              custom_id: 'report_category',
              label: 'Category (optional)',
              style: TextInputStyle.SHORT,
              placeholder: 'bug, feature, question, other',
              required: false,
              max_length: 50,
            }],
          },
        ],
      },
    });
  }

  // Defer the response — we'll follow up via QStash
  try {
    interaction.status = 'deferred';
    await interaction.save();

    // Publish to QStash for async processing
    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const messageId = await publishToQueue(
      `${appUrl}/api/discord/process`,
      { interactionId: interaction.discordInteractionId },
      { retries: 3 }
    );

    interaction.qstashMessageId = messageId;
    await interaction.save();
  } catch (error) {
    console.error('Failed to queue interaction:', error);
    // Even if queueing fails, we've already deferred — the interaction is persisted
    // and can be retried manually from the dashboard
  }

  return NextResponse.json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  });
}

/**
 * Handle button clicks (MESSAGE_COMPONENT interactions)
 */
async function handleComponentInteraction(body: DiscordInteraction) {
  const customId = body.data!.custom_id!;
  const username = body.member?.user?.username || body.user?.username || 'unknown';

  await connectDB();

  // Persist component interaction
  await Interaction.create({
    discordInteractionId: body.id,
    guildId: body.guild_id || '',
    channelId: body.channel_id || '',
    command: `button:${customId.split('_')[0]}`,
    commandOptions: { custom_id: customId, action: customId.split('_')[0] },
    username,
    userId: body.member?.user?.id || body.user?.id || '',
    rawPayload: body,
    status: 'success',
    interactionToken: body.token,
    discordResponseSent: true,
    mirrorSent: true,
  });

  if (customId.startsWith('ack_') || customId.startsWith('escalate_')) {
    const isAck = customId.startsWith('ack_');
    const targetId = customId.substring(customId.indexOf('_') + 1);
    
    // Extract original embeds
    const originalEmbeds = body.message?.embeds || [];
    let updatedEmbeds: any[] = [];
    
    if (originalEmbeds.length > 0) {
      const orig = originalEmbeds[0];
      const embed: any = {
        title: orig.title,
        description: orig.description,
        url: (orig as any).url,
        timestamp: orig.timestamp,
        color: orig.color,
      };

      if (orig.fields) {
        embed.fields = orig.fields.map(f => ({
          name: f.name,
          value: f.value,
          inline: f.inline,
        }));
      } else {
        embed.fields = [];
      }

      if (orig.footer) {
        embed.footer = {
          text: orig.footer.text,
          icon_url: orig.footer.icon_url,
        };
      }

      if ((orig as any).image) {
        embed.image = { url: (orig as any).image.url };
      }

      if (orig.thumbnail) {
        embed.thumbnail = { url: orig.thumbnail.url };
      }

      if (orig.author) {
        embed.author = {
          name: orig.author.name,
          icon_url: orig.author.icon_url,
          url: (orig as any).author.url,
        };
      }
      
      // Update color and add status field
      if (isAck) {
        embed.color = 0x10B981; // green
        embed.fields.push({
          name: '⚙️ Status Update',
          value: `✅ **Acknowledged** by @${username}`,
          inline: false
        });
      } else {
        embed.color = 0xEF4444; // red
        embed.fields.push({
          name: '⚙️ Status Update',
          value: `🚨 **Escalated** by @${username}`,
          inline: false
        });
      }
      updatedEmbeds.push(embed);
    }
    
    const disabledAction = isAck ? 'ack' : 'escalate';
    const updatedComponents = [
      {
        type: 1, // ACTION_ROW
        components: [
          {
            type: 2, // BUTTON
            style: 3, // SUCCESS
            label: disabledAction === 'ack' ? '✅ Acknowledged' : '✅ Acknowledge',
            custom_id: `ack_${targetId}`,
            disabled: disabledAction === 'ack',
          },
          {
            type: 2,
            style: 4, // DANGER
            label: disabledAction === 'escalate' ? '🚨 Escalated' : '🔴 Escalate',
            custom_id: `escalate_${targetId}`,
            disabled: disabledAction === 'escalate',
          },
          {
            type: 2,
            style: 2, // SECONDARY
            label: '📝 Add Note',
            custom_id: `note_${targetId}`,
          },
        ],
      },
    ];

    return NextResponse.json({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        embeds: updatedEmbeds,
        components: updatedComponents,
      }
    });
  }

  if (customId.startsWith('note_')) {
    // Open a modal for adding a note
    return NextResponse.json({
      type: InteractionResponseType.MODAL,
      data: {
        title: '📝 Add a Note',
        custom_id: `addnote_${customId.replace('note_', '')}`,
        components: [
          {
            type: ComponentType.ACTION_ROW,
            components: [{
              type: ComponentType.TEXT_INPUT,
              custom_id: 'note_text',
              label: 'Your note',
              style: TextInputStyle.PARAGRAPH,
              placeholder: 'Add context, updates, or follow-up information...',
              required: true,
              min_length: 1,
              max_length: 1000,
            }],
          },
        ],
      },
    });
  }

  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: 'Button action received.', flags: 64 },
  });
}

/**
 * Handle modal submissions
 */
async function handleModalSubmit(body: DiscordInteraction) {
  const customId = body.data!.custom_id!;
  const username = body.member?.user?.username || body.user?.username || 'unknown';

  await connectDB();

  // Extract modal field values
  const fields: Record<string, string> = {};
  if (body.data!.components) {
    for (const row of body.data!.components) {
      if (row.components) {
        for (const field of row.components) {
          fields[field.custom_id] = field.value;
        }
      }
    }
  }

  // Handle report modal submission
  if (customId.startsWith('report_modal_')) {
    const reportText = fields['report_text'] || '';
    const category = fields['report_category'] || '';

    // Create the interaction record
    const interaction = await Interaction.create({
      discordInteractionId: body.id,
      guildId: body.guild_id || '',
      channelId: body.channel_id || '',
      command: 'report',
      commandOptions: { text: reportText, category },
      username,
      userId: body.member?.user?.id || body.user?.id || '',
      rawPayload: body,
      status: 'deferred',
      interactionToken: body.token,
    });

    // Queue for async processing
    try {
      const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL;
      const messageId = await publishToQueue(
        `${appUrl}/api/discord/process`,
        { interactionId: interaction.discordInteractionId },
        { retries: 3 }
      );
      interaction.qstashMessageId = messageId;
      await interaction.save();
    } catch (error) {
      console.error('Failed to queue modal report:', error);
    }

    return NextResponse.json({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    });
  }

  // Handle add-note modal
  if (customId.startsWith('addnote_')) {
    const noteText = fields['note_text'] || '';

    await Interaction.create({
      discordInteractionId: body.id,
      guildId: body.guild_id || '',
      channelId: body.channel_id || '',
      command: 'button:note',
      commandOptions: { note: noteText, parent_id: customId.replace('addnote_', '') },
      username,
      userId: body.member?.user?.id || body.user?.id || '',
      rawPayload: body,
      status: 'success',
      interactionToken: body.token,
      discordResponseSent: true,
      mirrorSent: true,
    });

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `📝 **Note added** by ${username}:\n> ${noteText}`,
      },
    });
  }

  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: 'Form submitted.', flags: 64 },
  });
}

/**
 * /suggest <text> — defer and process async via QStash
 */
async function handleSuggestCommand(
  interaction: InstanceType<typeof Interaction>,
  options: Record<string, unknown>
) {
  try {
    interaction.status = 'deferred';
    await interaction.save();

    // Publish to QStash for async processing
    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const messageId = await publishToQueue(
      `${appUrl}/api/discord/process`,
      { interactionId: interaction.discordInteractionId },
      { retries: 3 }
    );

    interaction.qstashMessageId = messageId;
    await interaction.save();
  } catch (error) {
    console.error('Failed to queue suggestion:', error);
  }

  return NextResponse.json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  });
}

/**
 * /check-report <report_id> — retrieve report status from MongoDB instantly
 */
async function handleCheckReportCommand(
  interaction: InstanceType<typeof Interaction>,
  options: Record<string, unknown>
) {
  try {
    const reportId = String(options.report_id || '').trim();
    if (!reportId) {
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '❌ Please provide a valid report ID.', flags: 64 },
      });
    }

    // Find the report in MongoDB
    const targetReport = await Interaction.findOne({
      $or: [
        { discordInteractionId: reportId },
        { qstashMessageId: reportId }
      ]
    });

    if (!targetReport) {
      interaction.status = 'success';
      await interaction.save();

      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `❌ Report or Suggestion with ID \`${reportId}\` was not found. Please double-check the ID.`, flags: 64 },
      });
    }

    // Determine status color
    let color = 0x06B6D4; // cyan default
    if (targetReport.status === 'success') color = 0x10B981; // green
    if (targetReport.status === 'failed') color = 0xEF4444; // red
    if (targetReport.status === 'processing' || targetReport.status === 'deferred') color = 0xF59E0B; // amber

    const fields = [
      { name: '📋 Command Type', value: `\`/${targetReport.command}\``, inline: true },
      { name: '👤 Submitted By', value: `@${targetReport.username}`, inline: true },
      { name: '⏳ Current Status', value: `**${targetReport.status.toUpperCase()}**`, inline: true },
    ];

    const textContent = targetReport.commandOptions && (targetReport.commandOptions as any).text
      ? String((targetReport.commandOptions as any).text)
      : 'No text content';

    fields.push({ name: '📝 Original Content', value: textContent.slice(0, 1024), inline: false });

    if (targetReport.aiPriority) {
      fields.push({ name: '🚨 Priority Level', value: `\`${targetReport.aiPriority.toUpperCase()}\``, inline: true });
    }
    if (targetReport.aiSummary) {
      fields.push({ name: '🤖 AI Summary', value: targetReport.aiSummary, inline: false });
    }
    
    const ruleRes = targetReport.ruleResults as any;
    if (ruleRes && ruleRes.tags?.length > 0) {
      fields.push({
        name: '📌 Applied Tags',
        value: ruleRes.tags.map((t: string) => `\`${t}\``).join(' '),
        inline: true
      });
    }

    // Update the checking interaction as success
    interaction.status = 'success';
    await interaction.save();

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: `🔍 Report Status Lookup`,
          description: `Details for record ID: \`${reportId}\``,
          color,
          fields,
          timestamp: targetReport.createdAt ? new Date(targetReport.createdAt).toISOString() : new Date().toISOString(),
          footer: { text: 'CommandPulse Dashboard Integration' },
        }],
      },
    });
  } catch (error) {
    console.error('Check report error:', error);
    interaction.status = 'failed';
    await interaction.save();

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: '❌ An error occurred while checking report status.', flags: 64 },
    });
  }
}

/**
 * /help — display stylized help embed
 */
async function handleHelpCommand(interaction: InstanceType<typeof Interaction>) {
  try {
    interaction.status = 'success';
    await interaction.save();

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: '📖 CommandPulse Help & Commands',
          description: 'Welcome to the CommandPulse bot guide! Below is a list of all active slash commands and how to use them.',
          color: 0x06B6D4, // cyan
          fields: [
            {
              name: '📋 /report `[text]`',
              value: 'Submit a report for automated AI triage, categorization, and routing. Leave the `text` option blank to open a detailed modal form.'
            },
            {
              name: '💡 /suggest `<text>`',
              value: 'Submit feedback, server ideas, or general suggestions. These will be logged and routed to our suggestions channel.'
            },
            {
              name: '🔍 /check-report `<report_id>`',
              value: 'Query the live status of any previously submitted report or suggestion using its unique ID.'
            },
            {
              name: '📊 /status',
              value: 'Check bot diagnostic status, latency, uptime, and recent command activity logs.'
            },
            {
              name: '📖 /help',
              value: 'Display this command guide embed.'
            }
          ],
          footer: { text: 'CommandPulse · Intelligent Server Triage' },
          timestamp: new Date().toISOString()
        }]
      }
    });
  } catch (error) {
    console.error('Help command error:', error);
    interaction.status = 'failed';
    await interaction.save();

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: '❌ Failed to load the help embed.', flags: 64 },
    });
  }
}
