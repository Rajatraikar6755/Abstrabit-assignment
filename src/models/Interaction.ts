import mongoose, { Schema, Document } from 'mongoose';

export interface IAttempt {
  attemptNumber: number;
  status: 'success' | 'failed';
  error?: string;
  timestamp: Date;
  durationMs?: number;
}

export type InteractionStatus = 'received' | 'deferred' | 'processing' | 'success' | 'failed';

export interface IInteraction extends Document {
  discordInteractionId: string;
  guildId: string;
  channelId: string;
  command: string;
  commandOptions: Record<string, unknown>;
  username: string;
  userId: string;
  rawPayload: Record<string, unknown>;
  status: InteractionStatus;
  interactionToken: string;
  aiSummary: string;
  aiTags: string[];
  aiPriority: string;
  ruleResults: Record<string, unknown>;
  mirrorSent: boolean;
  discordResponseSent: boolean;
  attempts: IAttempt[];
  qstashMessageId: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttemptSchema = new Schema<IAttempt>({
  attemptNumber: { type: Number, required: true },
  status: { type: String, enum: ['success', 'failed'], required: true },
  error: { type: String },
  timestamp: { type: Date, default: Date.now },
  durationMs: { type: Number },
});

const InteractionSchema = new Schema<IInteraction>(
  {
    discordInteractionId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, default: '' },
    command: { type: String, required: true, index: true },
    commandOptions: { type: Schema.Types.Mixed, default: {} },
    username: { type: String, default: '' },
    userId: { type: String, default: '' },
    rawPayload: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['received', 'deferred', 'processing', 'success', 'failed'],
      default: 'received',
      index: true,
    },
    interactionToken: { type: String, default: '' },
    aiSummary: { type: String, default: '' },
    aiTags: [{ type: String }],
    aiPriority: { type: String, default: '' },
    ruleResults: { type: Schema.Types.Mixed, default: {} },
    mirrorSent: { type: Boolean, default: false },
    discordResponseSent: { type: Boolean, default: false },
    attempts: [AttemptSchema],
    qstashMessageId: { type: String, default: '' },
  },
  { timestamps: true }
);

// Compound index for dashboard queries
InteractionSchema.index({ createdAt: -1 });
InteractionSchema.index({ guildId: 1, createdAt: -1 });

export const Interaction = mongoose.models.Interaction || mongoose.model<IInteraction>('Interaction', InteractionSchema);
