export interface TriageResult {
  summary: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction: string;
}

/**
 * Use Groq API to triage and analyze a report submission.
 * Produces a structured summary, tags, priority, and suggested action.
 * Falls back to manual review if Groq fails or is not configured.
 */
export async function triageReport(
  reportText: string,
  username: string,
  context?: { recentReports?: string[] }
): Promise<TriageResult> {
  const contextSection = context?.recentReports?.length
    ? `\n\nRecent related reports for context:\n${context.recentReports.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
    : '';

  const prompt = `You are a report triage assistant for a Discord server. Analyze the following report and provide structured triage output.

Report submitted by: ${username}
Report text: "${reportText}"${contextSection}

Respond ONLY with valid JSON matching this exact structure (no markdown, no code fences):
{
  "summary": "A concise 1-2 sentence summary of the report",
  "tags": ["tag1", "tag2", "tag3"],
  "priority": "low|medium|high|critical",
  "suggestedAction": "A brief recommended next step"
}

Guidelines:
- Tags should be relevant categories (e.g., "bug", "feature-request", "security", "performance", "ux", "documentation")
- Priority: "critical" for security/data-loss/outage issues, "high" for blocking bugs, "medium" for non-blocking issues, "low" for suggestions/cosmetic
- Keep summary factual and concise
- suggestedAction should be actionable`;

  if (process.env.GROQ_API_KEY) {
    try {
      console.log('AI Triage: Attempting Groq API...');
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        throw new Error(`Groq API returned status ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error('Empty response from Groq');

      const parsed = JSON.parse(content) as TriageResult;

      // Validate structure
      if (!parsed.summary || !Array.isArray(parsed.tags) || !parsed.priority) {
        throw new Error('Invalid triage response structure from Groq');
      }

      // Normalize priority
      const validPriorities = ['low', 'medium', 'high', 'critical'] as const;
      if (!validPriorities.includes(parsed.priority)) {
        parsed.priority = 'medium';
      }

      console.log('AI Triage: Groq success!');
      return parsed;
    } catch (groqErr) {
      console.error('Groq triage failed:', groqErr);
    }
  }

  // Graceful fallback — never let AI failure block the interaction
  console.log('AI Triage: Using manual review fallback.');
  return {
    summary: reportText.slice(0, 200),
    tags: ['unprocessed'],
    priority: 'medium',
    suggestedAction: 'Manual review required — AI triage unavailable',
  };
}

/**
 * Generate a brief status summary from recent interaction data.
 */
export async function generateStatusSummary(stats: {
  totalToday: number;
  successRate: number;
  topCommands: { command: string; count: number }[];
  recentFailures: number;
}): Promise<string> {
  const prompt = `Generate a brief, friendly status summary (2-3 sentences) for a Discord bot dashboard based on these stats:
- Commands processed today: ${stats.totalToday}
- Success rate: ${(stats.successRate * 100).toFixed(1)}%
- Top commands: ${stats.topCommands.map(c => `${c.command} (${c.count})`).join(', ')}
- Recent failures: ${stats.recentFailures}

Keep it concise and informative. No markdown formatting. Just plain text.`;

  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
    } catch (e) {
      console.error('Groq status summary failed:', e);
    }
  }

  return `Today: ${stats.totalToday} commands processed with ${(stats.successRate * 100).toFixed(1)}% success rate.`;
}
