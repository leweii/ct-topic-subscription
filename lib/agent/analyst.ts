import { generate, parseJsonResponse } from '@/lib/gemini';
import type { Source, Insight, Language } from '@/lib/types';

const ANALYST_PROMPTS: Record<Language, string> = {
  en: `You are a senior industry analyst. Based on the filtered content, extract core insights.

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

Return ONLY the JSON array, no other text. Target: Extract 2-5 core insights.`,

  zh: `你是一位资深行业分析师。根据筛选后的内容，提取核心洞察。

## 研究意图
{topicIntent}

## 内容素材
{sourcesJson}

## 分析框架
对于每个重要发现，回答三个问题：
1. **发生了什么**：用一句话描述核心事实
2. **为什么重要**：对行业/用户/技术发展的影响
3. **新变化还是噪音**：是真正的突破/转折点，还是渐进式更新/炒作？

## 分析原则
- 综合多个来源，找出共同信号
- 区分事实陈述和观点/推测
- 标注信息的确定性程度

## 输出要求
返回 JSON 数组。每条洞察必须包含：
- headline: string（发生了什么，一句话）
- significance: string（为什么重要，2-3 句话）
- isNovelty: boolean（true=新变化，false=噪音/渐进）
- confidence: "high" | "medium" | "low"

只返回 JSON 数组，不要包含其他文字。目标：提取 2-5 条核心洞察。`,
};

export interface AnalystResult {
  insights: Insight[];
}

export async function analyst(
  keptSources: Source[],
  topicIntent: string,
  language: Language = 'en'
): Promise<AnalystResult> {
  const prompt = ANALYST_PROMPTS[language]
    .replace('{topicIntent}', topicIntent)
    .replace('{sourcesJson}', JSON.stringify(keptSources, null, 2));

  const response = await generate(prompt);
  const insights = parseJsonResponse<Insight[]>(response);

  return { insights };
}
