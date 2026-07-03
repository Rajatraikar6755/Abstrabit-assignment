import mongoose, { Schema, Document } from 'mongoose';

export interface IGuildConfig extends Document {
  discordGuildId: string;
  guildName: string;
  channelId: string;
  mirrorWebhookUrlEncrypted: string;
  mirrorType: 'slack' | 'discord';
  aiEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GuildConfigSchema = new Schema<IGuildConfig>(
  {
    discordGuildId: { type: String, required: true, unique: true },
    guildName: { type: String, default: '' },
    channelId: { type: String, default: '' },
    mirrorWebhookUrlEncrypted: { type: String, default: '' },
    mirrorType: { type: String, enum: ['slack', 'discord'], default: 'discord' },
    aiEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const GuildConfig = mongoose.models.GuildConfig || mongoose.model<IGuildConfig>('GuildConfig', GuildConfigSchema);
