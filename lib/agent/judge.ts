import { generate, parseJsonResponse } from '@/lib/gemini';
import type { Source } from '@/lib/types';

const JUDGE_PROMPT = `You are a strict content quality reviewer. Evaluate whether the following content is worth analyzing in depth.

## Research Intent
{topicIntent}

## Candidate Content
{sourcesJson}

## Evaluation Criteria
1. **Relevance**: Is it directly related to the research intent?
2. **Timeliness**: Is it new information, not a rehash of old news?
3. **Credibility**: Is the source reliable? Does the author have professional background?
4. **Depth**: Does it have substantial content, not just clickbait or shallow reporting?

## Deduplication Rules
- For multiple reports on the same event, keep only the 1-2 most in-depth pieces
- YouTube videos and corresponding blog posts count as duplicates; prefer the original source

## Output Requirements
Return a JSON array with each content item including these additional fields:
- kept: boolean (whether to keep)
- reason: string (under 20 words, reason for keeping or discarding)

Return ONLY the JSON array, no other text. Target: Keep 3-8 high-quality items.`;

export interface JudgeResult {
  allSources: Source[];
  keptSources: Source[];
}

export async function judge(
  sources: Source[],
  topicIntent: string
): Promise<JudgeResult> {
  const prompt = JUDGE_PROMPT
    .replace('{topicIntent}', topicIntent)
    .replace('{sourcesJson}', JSON.stringify(sources, null, 2));

  const response = await generate(prompt);
  const allSources = parseJsonResponse<Source[]>(response);
  const keptSources = allSources.filter((s) => s.kept);

  return { allSources, keptSources };
}
