import { generateWithSearch, parseJsonResponse } from '@/lib/gemini';
import type { Source, TimeWindow, Language } from '@/lib/types';

const SCOUT_PROMPTS: Record<Language, string> = {
  en: `You are a professional information scout. Search for high-quality recent content based on the user's research intent.

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

Return ONLY the JSON array, no other text. Target: Find 8-15 relevant results.`,

  zh: `你是一位专业的信息搜集员。根据用户的研究意图搜索高质量的最新内容。

## 研究意图
{topicIntent}

## 时间范围
过去 {timeWindow}

## 搜索策略
1. 搜索知名 AI/科技领域 YouTuber 的相关视频
2. 搜索行业 KOL 和独立研究者的博客文章
3. 搜索大公司（Google AI、OpenAI、Anthropic、Meta AI 等）的官方博客

## 输出要求
返回一个 JSON 数组。每条结果必须包含：
- title: 标题
- url: 链接
- author: 作者/频道名称
- publishedAt: 发布日期 (YYYY-MM-DD)
- sourceType: "youtube" | "blog" | "official"
- summary: 简要摘要（50 字以内）

只返回 JSON 数组，不要包含其他文字。目标：找到 8-15 条相关结果。`,
};

const TIME_WINDOW_MAP: Record<Language, Record<TimeWindow, string>> = {
  en: {
    '3d': '3 days',
    '7d': '7 days',
    '30d': '30 days',
  },
  zh: {
    '3d': '3 天',
    '7d': '7 天',
    '30d': '30 天',
  },
};

export interface ScoutResult {
  sources: Source[];
}

export async function scout(
  topicIntent: string,
  timeWindow: TimeWindow,
  language: Language = 'en'
): Promise<ScoutResult> {
  const prompt = SCOUT_PROMPTS[language]
    .replace('{topicIntent}', topicIntent)
    .replace('{timeWindow}', TIME_WINDOW_MAP[language][timeWindow]);

  const response = await generateWithSearch(prompt);
  const sources = parseJsonResponse<Source[]>(response);

  return { sources };
}
