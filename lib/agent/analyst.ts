import { generate, parseJsonResponse } from '@/lib/gemini';
import type { Source, Insight } from '@/lib/types';

const ANALYST_PROMPT = `You are a senior industry analyst. Based on the filtered content, extract core insights.

## Research Intent
{topicIntent}

## Content Materials
{sourcesJson}

## Analysis Framework
For each important finding, answer three questions:
1. **What happened**: Describe the core fact in one sentence
2. **Why it matters**: Impact on industry/users/technology development
3. **New change or noise**: Is it a real breakthrough/turning point, or just incremental/hype?

## Analysis Principles
- Correlate multiple sources to find common signals
- Distinguish between factual statements and opinion/speculation
- Mark the certainty level of information

## Output Requirements
Return a JSON array. Each insight must include:
- headline: string (what happened, one sentence)
- significance: string (why it matters, 2-3 sentences)
- isNovelty: boolean (true=new change, false=noise/incremental)
- confidence: "high" | "medium" | "low"

Return ONLY the JSON array, no other text. Target: Extract 2-5 core insights.`;

export interface AnalystResult {
  insights: Insight[];
}

export async function analyst(
  keptSources: Source[],
  topicIntent: string
): Promise<AnalystResult> {
  const prompt = ANALYST_PROMPT
    .replace('{topicIntent}', topicIntent)
    .replace('{sourcesJson}', JSON.stringify(keptSources, null, 2));

  const response = await generate(prompt);
  const insights = parseJsonResponse<Insight[]>(response);

  return { insights };
}
