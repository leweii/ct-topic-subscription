import { generate, parseJsonResponse } from '@/lib/gemini';
import type { Insight, ArtifactOutput, OutputMode, Language } from '@/lib/types';

const EDITOR_PROMPTS: Record<Language, Record<OutputMode, string>> = {
  en: {
    brief: `You are a professional tech editor. Transform insights into a PRACTICAL research brief.

## Insight Content
{insightsJson}

## Content Focus (IMPORTANT)
- Focus on: What's new? What can readers DO with this information?
- Include: Specific updates, practical tips, actionable takeaways
- Avoid: Conceptual explanations, "what is X" definitions, generic overviews

## Output Style
- Like a senior journalist writing a morning brief for practitioners
- Concise and powerful, one sentence per point
- Have opinions, dare to make judgments
- Lead with what's actionable

## Output Format
Return JSON:
{
  "title": "Brief title (under 10 words, highlights the news/update)",
  "body": "Body text (Markdown, under 200 words, 3-5 practical points)",
  "agentStatement": "My judgment: ... (one sentence on what practitioners should do)",
  "uncertainties": ["Point needing continued observation 1", "Uncertain point 2"]
}

Return ONLY the JSON, no other text.`,

    report: `You are a professional tech editor. Transform insights into a PRACTICAL research report.

## Insight Content
{insightsJson}

## Content Focus (IMPORTANT)
- Focus on: New developments, practical applications, actionable recommendations
- Include: Version numbers, real examples, performance data, implementation tips
- Avoid: "What is X" explanations, conceptual overviews, beginner introductions

## Output Style
- Like a top analyst's industry report for practitioners
- Clear structure with practical subheadings (e.g., "New Features", "How to Use", "Performance Gains")
- Clear stance and forward-looking judgments
- Every section should answer "so what can I do with this?"

## Output Format
Return JSON:
{
  "title": "Report title (under 15 words, highlights the practical value)",
  "body": "Body text (Markdown, 800-1200 words, with practical subheadings)",
  "agentStatement": "Core judgment: ... (2-3 sentences on practical implications)",
  "uncertainties": ["Point needing continued observation 1", "Controversial point 2", "Insufficient data point 3"]
}

Return ONLY the JSON, no other text.`,
  },

  zh: {
    brief: `你是一位专业的科技编辑。将洞察转化为**实用**的研究简报。

## 洞察内容
{insightsJson}

## 内容重点（重要）
- 聚焦：有什么新动态？读者可以用这些信息做什么？
- 包含：具体更新、实用技巧、可操作建议
- 避免：概念解释、"什么是 X"的定义、泛泛概述

## 输出风格
- 像资深记者为从业者写的晨间简报
- 简洁有力，每点一句话
- 有观点，敢下判断
- 以可操作的内容开头

## 输出格式
返回 JSON：
{
  "title": "简报标题（10 字以内，突出新闻/更新）",
  "body": "正文（Markdown 格式，200 字以内，3-5 个实用要点）",
  "agentStatement": "我的判断：...（一句话说从业者应该怎么做）",
  "uncertainties": ["需要持续观察的点 1", "不确定的点 2"]
}

只返回 JSON，不要包含其他文字。`,

    report: `你是一位专业的科技编辑。将洞察转化为**实用**的深度研究报告。

## 洞察内容
{insightsJson}

## 内容重点（重要）
- 聚焦：新动态、实际应用、可操作建议
- 包含：版本号、真实案例、性能数据、实现技巧
- 避免："什么是 X"的解释、概念概述、入门介绍

## 输出风格
- 像顶级分析师为从业者写的行业报告
- 结构清晰，小标题要实用（如"新功能"、"如何使用"、"性能提升"）
- 立场明确，有前瞻性判断
- 每个部分都要回答"我能用这个做什么？"

## 输出格式
返回 JSON：
{
  "title": "报告标题（15 字以内，突出实用价值）",
  "body": "正文（Markdown 格式，800-1200 字，含实用小标题）",
  "agentStatement": "核心判断：...（2-3 句话阐述实际影响）",
  "uncertainties": ["需要持续观察的点 1", "存在争议的点 2", "数据不足的点 3"]
}

只返回 JSON，不要包含其他文字。`,
  },
};

export async function editor(
  insights: Insight[],
  outputMode: OutputMode,
  language: Language
): Promise<ArtifactOutput> {
  const prompt = EDITOR_PROMPTS[language][outputMode]
    .replace('{insightsJson}', JSON.stringify(insights, null, 2));

  const response = await generate(prompt);
  return parseJsonResponse<ArtifactOutput>(response);
}
