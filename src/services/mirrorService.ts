import { decrypt } from '@/lib/security/encryption';
import { DiscordEmbed } from '@/lib/discord/types';

interface MirrorPayload {
  command: string;
  username: string;
  guildName: string;
  text?: string;
  aiSummary?: string;
  aiTags?: string[];
  aiPriority?: string;
  timestamp: string;
}

/**
 * Send a mirror notification to either a Slack Incoming Webhook
 * or a Discord channel webhook.
 */
export async function sendMirrorNotification(
  encryptedWebhookUrl: string,
  mirrorType: 'slack' | 'discord',
  payload: MirrorPayload
): Promise<void> {
  const webhookUrl = decrypt(encryptedWebhookUrl);

  if (mirrorType === 'slack') {
    await sendSlackMirror(webhookUrl, payload);
  } else {
    await sendDiscordMirror(webhookUrl, payload);
  }
}

async function sendSlackMirror(webhookUrl: string, payload: MirrorPayload): Promise<void> {
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `⚡ Discord Command: /${payload.command}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*User:*\n${payload.username}` },
        { type: 'mrkdwn', text: `*Server:*\n${payload.guildName}` },
        { type: 'mrkdwn', text: `*Time:*\n${payload.timestamp}` },
        ...(payload.aiPriority ? [{ type: 'mrkdwn', text: `*Priority:*\n${payload.aiPriority.toUpperCase()}` }] : []),
      ],
    },
  ];

  if (payload.text) {
    blocks.push({
      type: 'section',
      fields: [{ type: 'mrkdwn', text: `*Content:*\n${payload.text.slice(0, 500)}` }],
    });
  }

  if (payload.aiSummary) {
    blocks.push({
      type: 'section',
      fields: [{ type: 'mrkdwn', text: `*AI Summary:*\n${payload.aiSummary}` }],
    });
  }

  if (payload.aiTags?.length) {
    blocks.push({
      type: 'section' as const,
      fields: [{ type: 'mrkdwn', text: `*Tags:*\n${payload.aiTags.map(t => `\`${t}\``).join(' ')}` }],
    });
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `⚡ /${payload.command} by ${payload.username}`,
      blocks,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Slack mirror failed (${res.status}): ${text}`);
  }
}

async function sendDiscordMirror(webhookUrl: string, payload: MirrorPayload): Promise<void> {
  const priorityColors: Record<string, number> = {
    critical: 0xFF0000,
    high: 0xFF8C00,
    medium: 0xFFD700,
    low: 0x00FF00,
    normal: 0x5865F2,
  };

  const embed: DiscordEmbed = {
    title: `⚡ /${payload.command}`,
    color: priorityColors[payload.aiPriority || 'normal'] || 0x5865F2,
    fields: [
      { name: 'User', value: payload.username, inline: true },
      { name: 'Server', value: payload.guildName, inline: true },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Discord Bot Mirror' },
  };

  if (payload.text) {
    embed.fields!.push({ name: 'Content', value: payload.text.slice(0, 1024) });
  }

  if (payload.aiSummary) {
    embed.fields!.push({ name: '🤖 AI Summary', value: payload.aiSummary });
  }

  if (payload.aiTags?.length) {
    embed.fields!.push({ name: 'Tags', value: payload.aiTags.map(t => `\`${t}\``).join(' '), inline: true });
  }

  if (payload.aiPriority) {
    embed.fields!.push({ name: 'Priority', value: payload.aiPriority.toUpperCase(), inline: true });
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord mirror failed (${res.status}): ${text}`);
  }
}
