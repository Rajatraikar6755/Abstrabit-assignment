import { IRule, IAction, ICommandConfig } from '@/models/CommandConfig';

export interface RuleEngineResult {
  matched: boolean;
  matchedRules: IRule[];
  appliedActions: IAction[];
  tags: string[];
  priority: string;
  autoReply: string;
}

/**
 * Evaluate a command's input text against the configured rules.
 * Returns which rules matched and what actions should be taken.
 */
export function evaluateRules(
  inputText: string,
  config: ICommandConfig | null
): RuleEngineResult {
  const result: RuleEngineResult = {
    matched: false,
    matchedRules: [],
    appliedActions: [],
    tags: [],
    priority: 'normal',
    autoReply: '',
  };

  if (!config || !config.enabled || !config.rules?.length) {
    return result;
  }

  for (const rule of config.rules) {
    if (matchesRule(inputText, rule)) {
      result.matched = true;
      result.matchedRules.push(rule);
    }
  }

  if (result.matched && config.actions?.length) {
    for (const action of config.actions) {
      result.appliedActions.push(action);
      applyAction(action, result);
    }
  }

  return result;
}

function matchesRule(text: string, rule: IRule): boolean {
  const fieldValue = text; // For now, all rules apply to the input text
  const compareValue = rule.value;

  switch (rule.operator) {
    case 'contains':
      return fieldValue.toLowerCase().includes(compareValue.toLowerCase());
    case 'equals':
      return fieldValue.toLowerCase() === compareValue.toLowerCase();
    case 'startsWith':
      return fieldValue.toLowerCase().startsWith(compareValue.toLowerCase());
    case 'endsWith':
      return fieldValue.toLowerCase().endsWith(compareValue.toLowerCase());
    case 'regex':
      try {
        return new RegExp(compareValue, 'i').test(fieldValue);
      } catch {
        return false;
      }
    case 'lengthGreaterThan':
      return fieldValue.length > parseInt(compareValue, 10);
    case 'lengthLessThan':
      return fieldValue.length < parseInt(compareValue, 10);
    default:
      return false;
  }
}

function applyAction(action: IAction, result: RuleEngineResult): void {
  switch (action.type) {
    case 'tag':
      if (action.params.tag) {
        result.tags.push(action.params.tag);
      }
      break;
    case 'priority':
      if (action.params.level) {
        result.priority = action.params.level;
      }
      break;
    case 'autoReply':
      if (action.params.message) {
        result.autoReply = action.params.message;
      }
      break;
    case 'mirrorOverride':
      // Handled downstream
      break;
  }
}
