import { generate, parseJsonResponse } from '@/lib/gemini';
import type { Source, Insight, Language } from '@/lib/types';

const ANALYST_PROMPTS: Record<Language, string> = {
  en: `You are a senior industry analyst. Extract PRACTICAL insights from the content.

## Research Intent
{topicIntent}

## Content Materials
{sourcesJson}

## Analysis Focus (IMPORTANT)
Focus on extracting:
1. **New Developments**: What's been released, updated, or changed?
2. **Practical Applications**: How are people actually using this? What problems does it solve?
3. **Actionable Takeaways**: What can practitioners do differently based on this information?

## DO NOT Include
- Conceptual explanations of what the technology is
- Basic introductions or definitions
- Generic benefits without specific examples

## DO Include
- Specific version numbers, release dates, new features
- Real-world implementation examples
- Performance improvements with numbers
- New use cases or creative applications
- Community trends and emerging best practices

## Output Requirements
Return a JSON array. Each insight must include:
- headline: string (what's new or what people are doing, one sentence)
- significance: string (practical impact and actionable takeaway, 2-3 sentences)
- isNovelty: boolean (true=new development, false=incremental update)
- confidence: "high" | "medium" | "low"

Return ONLY the JSON array, no other text. Target: Extract 2-5 practical insights.`,

  zh: `你是一位资深行业分析师。从内容中提取**实用洞察**。

## 研究意图
{topicIntent}

## 内容素材
{sourcesJson}

## 分析重点（重要）
重点提取：
1. **新动态**：发布了什么新版本、更新了什么、有什么变化？
2. **实际应用**：人们实际上是怎么用的？解决了什么问题？
3. **可操作建议**：基于这些信息，从业者可以做什么不同的事？

## 不要包含
- 技术概念的解释说明
- 基础入门或定义
- 没有具体案例的泛泛好处

## 要包含
- 具体版本号、发布日期、新功能
- 真实的实现案例
- 带数据的性能提升
- 新的使用场景或创意应用
- 社区趋势和新兴最佳实践

## 输出要求
返回 JSON 数组。每条洞察必须包含：
- headline: string（有什么新动态或人们在做什么，一句话）
- significance: string（实际影响和可操作建议，2-3 句话）
- isNovelty: boolean（true=新发展，false=渐进更新）
- confidence: "high" | "medium" | "low"

只返回 JSON 数组，不要包含其他文字。目标：提取 2-5 条实用洞察。`,
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
