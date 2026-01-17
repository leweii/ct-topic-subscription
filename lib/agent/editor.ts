import { generate, parseJsonResponse } from '@/lib/gemini';
import type { Insight, ArtifactOutput, OutputMode, Language } from '@/lib/types';

const EDITOR_PROMPTS: Record<Language, Record<OutputMode, string>> = {
  en: {
    brief: `You are a professional tech editor. Transform insights into a well-structured research brief.

## Insight Content
{insightsJson}

## Content Focus (IMPORTANT)
- Focus on: What's new? What can readers DO with this information?
- Include: Specific updates, practical tips, actionable takeaways
- Avoid: Conceptual explanations, "what is X" definitions, generic overviews

## Output Structure (CRITICAL)
Use clear Markdown hierarchy:
- Use ## for main sections (2-3 sections)
- Each section has a clear title + content underneath
- Content under each title should be 2-4 bullet points or short paragraphs

Example structure:
## 🚀 Key Updates
- Point 1 with details
- Point 2 with details

## 💡 Practical Takeaways
- What you can do now
- Quick wins

## Output Format
Return JSON:
{
  "title": "Brief title (under 10 words, highlights the news/update)",
  "body": "Markdown with ## sections, each with title + content, under 300 words total",
  "agentStatement": "My judgment: ... (one sentence on what practitioners should do)",
  "uncertainties": ["Point needing continued observation 1", "Uncertain point 2"]
}

Return ONLY the JSON, no other text.`,

    report: `You are a professional tech editor. Transform insights into a well-structured research report.

## Insight Content
{insightsJson}

## Content Focus (IMPORTANT)
- Focus on: New developments, practical applications, actionable recommendations
- Include: Version numbers, real examples, performance data, implementation tips
- Avoid: "What is X" explanations, conceptual overviews, beginner introductions

## Output Structure (CRITICAL)
Use clear Markdown hierarchy for readability:
- Use ## for main sections (3-5 sections)
- Use ### for subsections within main sections
- Each section/subsection has: Title → Content (paragraphs or bullet points)
- Add horizontal rules (---) between major sections for visual separation

Example structure:
## 🔥 Major Developments

### Feature A Released
Detailed content about Feature A...
- Key point 1
- Key point 2

### Feature B Updates
Detailed content about Feature B...

---

## 💡 Practical Applications

### Use Case 1
How to apply this...

### Use Case 2
Another application...

---

## 📊 Performance & Data
Metrics and benchmarks...

## Output Format
Return JSON:
{
  "title": "Report title (under 15 words, highlights the practical value)",
  "body": "Markdown with ## and ### hierarchy, --- separators, 800-1500 words",
  "agentStatement": "Core judgment: ... (2-3 sentences on practical implications)",
  "uncertainties": ["Point needing continued observation 1", "Controversial point 2", "Insufficient data point 3"]
}

Return ONLY the JSON, no other text.`,
  },

  zh: {
    brief: `你是一位专业的科技编辑。将洞察转化为**结构清晰**的研究简报。

## 洞察内容
{insightsJson}

## 内容重点（重要）
- 聚焦：有什么新动态？读者可以用这些信息做什么？
- 包含：具体更新、实用技巧、可操作建议
- 避免：概念解释、"什么是 X"的定义、泛泛概述

## 输出结构（关键）
使用清晰的 Markdown 层级：
- 用 ## 作为主要章节标题（2-3 个章节）
- 每个章节有明确的标题 + 下方内容
- 每个标题下的内容为 2-4 个要点或简短段落

结构示例：
## 🚀 核心动态
- 要点 1 及详情
- 要点 2 及详情

## 💡 实操建议
- 现在可以做什么
- 快速行动项

## 输出格式
返回 JSON：
{
  "title": "简报标题（10 字以内，突出新闻/更新）",
  "body": "Markdown 格式，用 ## 分章节，每章节有标题+内容，总计 300 字以内",
  "agentStatement": "我的判断：...（一句话说从业者应该怎么做）",
  "uncertainties": ["需要持续观察的点 1", "不确定的点 2"]
}

只返回 JSON，不要包含其他文字。`,

    report: `你是一位专业的科技编辑。将洞察转化为**层次分明**的深度研究报告。

## 洞察内容
{insightsJson}

## 内容重点（重要）
- 聚焦：新动态、实际应用、可操作建议
- 包含：版本号、真实案例、性能数据、实现技巧
- 避免："什么是 X"的解释、概念概述、入门介绍

## 输出结构（关键）
使用清晰的 Markdown 层级增强可读性：
- 用 ## 作为主要章节（3-5 个章节）
- 用 ### 作为章节内的小节
- 每个章节/小节：标题 → 内容（段落或要点列表）
- 主要章节之间用分隔线（---）区分

结构示例：
## 🔥 重大进展

### 功能 A 发布
关于功能 A 的详细内容...
- 关键点 1
- 关键点 2

### 功能 B 更新
关于功能 B 的详细内容...

---

## 💡 实际应用

### 应用场景 1
如何应用...

### 应用场景 2
另一个应用...

---

## 📊 性能与数据
指标和基准测试...

## 输出格式
返回 JSON：
{
  "title": "报告标题（15 字以内，突出实用价值）",
  "body": "Markdown 格式，用 ## 和 ### 分层级，用 --- 分隔，800-1500 字",
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
