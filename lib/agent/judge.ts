import { generate, parseJsonResponse } from '@/lib/gemini';
import type { Source, Language } from '@/lib/types';

const JUDGE_PROMPTS: Record<Language, string> = {
  en: `You are a strict content quality reviewer. Evaluate whether the following content is worth analyzing in depth.

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

Return ONLY the JSON array, no other text. Target: Keep 3-8 high-quality items.`,

  zh: `你是一位严格的内容质量审核员。评估以下内容是否值得深入分析。

## 研究意图
{topicIntent}

## 候选内容
{sourcesJson}

## 评估标准
1. **相关性**：是否与研究意图直接相关？
2. **时效性**：是否是新信息，而非旧闻翻炒？
3. **可信度**：来源是否可靠？作者是否有专业背景？
4. **深度**：是否有实质内容，而非标题党或浅层报道？

## 去重规则
- 同一事件的多篇报道，只保留 1-2 篇最深入的
- YouTube 视频和对应的博客文章视为重复，优先保留原始来源

## 输出要求
返回 JSON 数组，每条内容新增以下字段：
- kept: boolean（是否保留）
- reason: string（20 字以内，保留或丢弃的原因）

只返回 JSON 数组，不要包含其他文字。目标：保留 3-8 条高质量内容。`,
};

export interface JudgeResult {
  allSources: Source[];
  keptSources: Source[];
}

export async function judge(
  sources: Source[],
  topicIntent: string,
  language: Language = 'en'
): Promise<JudgeResult> {
  const prompt = JUDGE_PROMPTS[language]
    .replace('{topicIntent}', topicIntent)
    .replace('{sourcesJson}', JSON.stringify(sources, null, 2));

  const response = await generate(prompt);
  const allSources = parseJsonResponse<Source[]>(response);
  const keptSources = allSources.filter((s) => s.kept);

  return { allSources, keptSources };
}
