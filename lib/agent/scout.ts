import { generateWithSearch, parseJsonResponse } from '@/lib/gemini';
import type { Source, TimeWindow } from '@/lib/types';

const SCOUT_PROMPT = `You are a professional information scout. Search for high-quality recent content based on the user's research intent.

## Research Intent
{topicIntent}

## Time Range
Past {timeWindow}

## Search Strategy
1. Search for relevant videos from well-known AI/tech YouTubers
2. Search for blog posts from industry KOLs and independent researchers
3. Search for official blog posts from major companies (Google AI, OpenAI, Anthropic, Meta AI, etc.)

## Output Requirements
Return a JSON array. Each result must include:
- title: Title
- url: Link
- author: Author/Channel name
- publishedAt: Publication date (YYYY-MM-DD)
- sourceType: "youtube" | "blog" | "official"
- summary: Brief summary (under 50 words)

Return ONLY the JSON array, no other text. Target: Find 8-15 relevant results.`;

const TIME_WINDOW_MAP: Record<TimeWindow, string> = {
  '3d': '3 days',
  '7d': '7 days',
  '30d': '30 days',
};

export interface ScoutResult {
  sources: Source[];
}

export async function scout(
  topicIntent: string,
  timeWindow: TimeWindow
): Promise<ScoutResult> {
  const prompt = SCOUT_PROMPT
    .replace('{topicIntent}', topicIntent)
    .replace('{timeWindow}', TIME_WINDOW_MAP[timeWindow]);

  const response = await generateWithSearch(prompt);
  const sources = parseJsonResponse<Source[]>(response);

  return { sources };
}
