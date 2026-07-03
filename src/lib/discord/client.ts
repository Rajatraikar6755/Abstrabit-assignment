import { DiscordEmbed } from './types';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

function getHeaders(): Record<string, string> {
  return {
    'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Edit the original deferred interaction response (follow-up).
 */
export async function editOriginalInteractionResponse(
  applicationId: string,
  interactionToken: string,
  content: string,
  embeds?: DiscordEmbed[],
  components?: unknown[]
): Promise<void> {
  const url = `${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  
  const body: Record<string, unknown> = {};
  if (content) body.content = content;
  if (embeds) body.embeds = embeds;
  if (components) body.components = components;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord edit response failed (${res.status}): ${text}`);
  }
}

/**
 * Send a follow-up message to the interaction.
 */
export async function sendFollowUpMessage(
  applicationId: string,
  interactionToken: string,
  content: string,
  embeds?: DiscordEmbed[],
  components?: unknown[],
  ephemeral = false
): Promise<void> {
  const url = `${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`;
  
  const body: Record<string, unknown> = {};
  if (content) body.content = content;
  if (embeds) body.embeds = embeds;
  if (components) body.components = components;
  if (ephemeral) body.flags = 64; // EPHEMERAL flag

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord follow-up failed (${res.status}): ${text}`);
  }
}

/**
 * Send a message to a Discord channel.
 */
export async function sendChannelMessage(
  channelId: string,
  content: string,
  embeds?: DiscordEmbed[]
): Promise<void> {
  const url = `${DISCORD_API_BASE}/channels/${channelId}/messages`;
  
  const body: Record<string, unknown> = {};
  if (content) body.content = content;
  if (embeds) body.embeds = embeds;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord channel message failed (${res.status}): ${text}`);
  }
}

/**
 * Get guild info to verify the bot is connected.
 */
export async function getGuild(guildId: string): Promise<{ id: string; name: string; icon: string | null }> {
  const url = `${DISCORD_API_BASE}/guilds/${guildId}`;
  
  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord get guild failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Get channels in a guild.
 */
export async function getGuildChannels(guildId: string): Promise<{ id: string; name: string; type: number }[]> {
  const url = `${DISCORD_API_BASE}/guilds/${guildId}/channels`;
  
  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord get channels failed (${res.status}): ${text}`);
  }

  return res.json();
}
