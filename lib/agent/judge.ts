import { generate, parseJsonResponse } from '@/lib/gemini';
import type { Source, Language } from '@/lib/types';

const JUDGE_PROMPTS: Record<Language, string> = {
  en: `You are a strict content quality reviewer. Filter content to keep only items with PRACTICAL VALUE.

## Research Intent
{topicIntent}

## Candidate Content
{sourcesJson}

## Evaluation Criteria (IMPORTANT)
1. **Practical Value**: Does it show HOW to use something, or report NEW developments?
2. **Actionable Content**: Tutorials, case studies, release notes > general overviews or concept explanations
3. **Timeliness**: Recent updates, new features, breaking news > evergreen explainers
4. **Credibility**: Official sources, experienced practitioners > generic content farms

## DISCARD These Types
- Conceptual explanations ("What is X?")
- Introductory overviews for beginners
- Old content rehashed
- Clickbait without substance

## KEEP These Types
- New release announcements
- Practical tutorials showing real implementation
- Case studies with specific details
- Community discussions about new features
- Experienced practitioners sharing tips

## Deduplication Rules
- For multiple reports on the same event, keep only the 1-2 most in-depth pieces
- YouTube videos and corresponding blog posts count as duplicates; prefer the original source

## Output Requirements
Return a JSON array with each content item including these additional fields:
- kept: boolean (whether to keep)
- reason: string (under 20 words, reason for keeping or discarding)

Return ONLY the JSON array, no other text. Target: Keep 3-8 high-quality items.`,

  zh: `你是一位严格的内容质量审核员。筛选出具有**实用价值**的内容。

## 研究意图
{topicIntent}

## 候选内容
{sourcesJson}

## 评估标准（重要）
1. **实用价值**：是否展示了如何使用，或报道了新动态？
2. **可操作性**：教程、案例、更新日志 > 概念解释或入门介绍
3. **时效性**：最新更新、新功能、突发新闻 > 常青内容或概念科普
4. **可信度**：官方来源、资深从业者 > 普通内容农场

## 丢弃这类内容
- 概念解释类（"什么是 X？"）
- 面向初学者的入门介绍
- 旧内容翻炒
- 标题党无实质内容

## 保留这类内容
- 新版本发布公告
- 展示真实实现的实操教程
- 有具体细节的案例研究
- 关于新功能的社区讨论
- 资深从业者分享的技巧

## 去重规则
- 同一事件的多篇报道，只保留 1-2 篇最深入的
- YouTube 视频和对应的博客文章视为重复，优先保留原始来源

## 输出要求
返回 JSON 数组，每条内容新增以下字段：
- kept: boolean（是否保留）
- reason: string（20 字以内，保留或丢弃的原因）

只返回 JSON 数组，不要包含其他文字。目标：保留 3-8 条高质量内容。`,
};

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface JudgeResult {
  allSources: Source[];
  keptSources: Source[];
  filteredByDate: number;
}

function isWithinDateRange(publishedAt: string, dateRange: DateRange): boolean {
  // Handle various date formats
  const pubDate = new Date(publishedAt);
  if (isNaN(pubDate.getTime())) {
    // If date is invalid, assume it's old and filter it out
    return false;
  }

  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);
  // Add one day to end date to include the full end day
  end.setDate(end.getDate() + 1);

  return pubDate >= start && pubDate < end;
}

export async function judge(
  sources: Source[],
  topicIntent: string,
  language: Language = 'en',
  dateRange?: DateRange
): Promise<JudgeResult> {
  // Step 1: Hard date filter (if dateRange provided)
  let filteredByDate = 0;
  let sourcesToJudge = sources;

  if (dateRange) {
    const dateFilteredSources: Source[] = [];
    const outOfRangeSources: Source[] = [];

    for (const source of sources) {
      if (isWithinDateRange(source.publishedAt, dateRange)) {
        dateFilteredSources.push(source);
      } else {
        outOfRangeSources.push({
          ...source,
          kept: false,
          reason: language === 'zh'
            ? `超出时间范围 (${dateRange.startDate} - ${dateRange.endDate})`
            : `Outside date range (${dateRange.startDate} - ${dateRange.endDate})`,
        });
        filteredByDate++;
      }
    }

    sourcesToJudge = dateFilteredSources;

    // If no sources left after date filtering, return early
    if (sourcesToJudge.length === 0) {
      return {
        allSources: outOfRangeSources,
        keptSources: [],
        filteredByDate,
      };
    }
  }

  // Step 2: Quality filter via LLM
  const prompt = JUDGE_PROMPTS[language]
    .replace('{topicIntent}', topicIntent)
    .replace('{sourcesJson}', JSON.stringify(sourcesToJudge, null, 2));

  const response = await generate(prompt);
  const judgedSources = parseJsonResponse<Source[]>(response);
  const keptSources = judgedSources.filter((s) => s.kept);

  // Combine date-filtered sources with quality-filtered sources
  const allSources = dateRange
    ? [
        ...judgedSources,
        ...sources
          .filter((s) => !isWithinDateRange(s.publishedAt, dateRange))
          .map((s) => ({
            ...s,
            kept: false,
            reason: language === 'zh'
              ? `超出时间范围 (${dateRange.startDate} - ${dateRange.endDate})`
              : `Outside date range (${dateRange.startDate} - ${dateRange.endDate})`,
          })),
      ]
    : judgedSources;

  return { allSources, keptSources, filteredByDate };
}
