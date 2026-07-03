import mongoose, { Schema, Document } from 'mongoose';

export interface IRule {
  field: string;
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex' | 'lengthGreaterThan' | 'lengthLessThan';
  value: string;
}

export interface IAction {
  type: 'tag' | 'priority' | 'autoReply' | 'mirrorOverride';
  params: Record<string, string>;
}

export interface ICommandConfig extends Document {
  commandName: string;
  guildId: string;
  description: string;
  enabled: boolean;
  rules: IRule[];
  actions: IAction[];
  createdAt: Date;
  updatedAt: Date;
}

const RuleSchema = new Schema<IRule>({
  field: { type: String, required: true },
  operator: { 
    type: String, 
    required: true,
    enum: ['contains', 'equals', 'startsWith', 'endsWith', 'regex', 'lengthGreaterThan', 'lengthLessThan'],
  },
  value: { type: String, required: true },
});

const ActionSchema = new Schema<IAction>({
  type: { 
    type: String, 
    required: true,
    enum: ['tag', 'priority', 'autoReply', 'mirrorOverride'],
  },
  params: { type: Schema.Types.Mixed, default: {} },
});

const CommandConfigSchema = new Schema<ICommandConfig>(
  {
    commandName: { type: String, required: true },
    guildId: { type: String, required: true },
    description: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    rules: [RuleSchema],
    actions: [ActionSchema],
  },
  { timestamps: true }
);

CommandConfigSchema.index({ commandName: 1, guildId: 1 }, { unique: true });

export const CommandConfig = mongoose.models.CommandConfig || mongoose.model<ICommandConfig>('CommandConfig', CommandConfigSchema);
