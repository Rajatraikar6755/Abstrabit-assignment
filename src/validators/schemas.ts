import { z } from 'zod';

// Discord interaction payload validator (extremely loose and robust to prevent validation failures on new/changed Discord API fields)
export const discordInteractionSchema = z.object({
  id: z.string(),
  application_id: z.string(),
  type: z.number().int().min(1).max(5),
  data: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    type: z.number().optional(),
    options: z.array(z.object({
      name: z.string(),
      type: z.number(),
      value: z.union([z.string(), z.number(), z.boolean()]).optional(),
      options: z.array(z.any()).optional(),
    })).optional(),
    custom_id: z.string().optional(),
    component_type: z.number().optional(),
    components: z.array(z.any()).optional(),
  }).catchall(z.any()).optional(),
  guild_id: z.string().optional(),
  channel_id: z.string().optional(),
  member: z.any().optional(),
  user: z.any().optional(),
  token: z.string(),
  version: z.number(),
  message: z.any().optional(),
}).passthrough();

// Guild configuration update schema
export const guildConfigUpdateSchema = z.object({
  channelId: z.string().optional(),
  mirrorWebhookUrl: z.string().url().optional().or(z.literal('')),
  mirrorType: z.enum(['slack', 'discord']).optional(),
  aiEnabled: z.boolean().optional(),
});

// Command config rule schema
export const ruleSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['contains', 'equals', 'startsWith', 'endsWith', 'regex', 'lengthGreaterThan', 'lengthLessThan']),
  value: z.string(),
});

// Command config action schema
export const actionSchema = z.object({
  type: z.enum(['tag', 'priority', 'autoReply', 'mirrorOverride']),
  params: z.record(z.string(), z.string()),
});

// Command config update schema
export const commandConfigUpdateSchema = z.object({
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  rules: z.array(ruleSchema).optional(),
  actions: z.array(actionSchema).optional(),
});

// QStash process payload schema
export const processPayloadSchema = z.object({
  interactionId: z.string(),
});
