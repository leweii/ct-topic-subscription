import { generate, parseJsonResponse } from '@/lib/gemini';
import type { Insight, ArtifactOutput, OutputMode } from '@/lib/types';

const EDITOR_PROMPT_BRIEF = `You are a professional tech editor. Transform analysis insights into a concise research brief.

## Insight Content
{insightsJson}

## Output Style
- Like a senior journalist writing a morning brief for executives, NOT an AI-generated summary
- Concise and powerful, one sentence per point
- Have opinions, dare to make judgments
- Avoid template expressions like "firstly, secondly, in conclusion"

## Output Format
Return JSON:
{
  "title": "Brief title (under 10 words, eye-catching)",
  "body": "Body text (Markdown, under 200 words, 3-5 points)",
  "agentStatement": "My judgment: ... (one sentence summarizing your core view)",
  "uncertainties": ["Point needing continued observation 1", "Uncertain point 2"]
}

Return ONLY the JSON, no other text.`;

const EDITOR_PROMPT_REPORT = `You are a professional tech editor. Transform analysis insights into a deep research report.

## Insight Content
{insightsJson}

## Output Style
- Like a top analyst's industry report, NOT an AI-generated summary
- Clear structure, sufficient evidence
- Clear stance and forward-looking judgments
- Professional but not obscure language

## Output Format
Return JSON:
{
  "title": "Report title (under 15 words)",
  "body": "Body text (Markdown, 800-1200 words, with subheadings)",
  "agentStatement": "Core judgment: ... (2-3 sentences elaborating your core view)",
  "uncertainties": ["Point needing continued observation 1", "Controversial point 2", "Insufficient data point 3"]
}

Return ONLY the JSON, no other text.`;

export async function editor(
  insights: Insight[],
  outputMode: OutputMode
): Promise<ArtifactOutput> {
  const promptTemplate = outputMode === 'brief' ? EDITOR_PROMPT_BRIEF : EDITOR_PROMPT_REPORT;
  const prompt = promptTemplate.replace('{insightsJson}', JSON.stringify(insights, null, 2));

  const response = await generate(prompt);
  return parseJsonResponse<ArtifactOutput>(response);
}
