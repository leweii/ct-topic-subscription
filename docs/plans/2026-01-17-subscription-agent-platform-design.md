# 订阅式认知 Agent 平台 MVP 设计

## 概述

用户创建订阅，Agent 基于用户的 Topic 意图，检索过去一段时间内的高质量内容，进行分析、判断和总结，输出结构化研究简报。

## 技术栈

- **前端 & Server**: Vercel (Next.js App Router)
- **数据库**: Supabase (Postgres + Auth)
- **AI**: Gemini (Grounding with Google Search)
- **安全**: Cloudflare Turnstile (登录保护)

## 项目结构

```
daily_report/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx        # 登录页 (Magic Link + Turnstile)
│   │   └── callback/route.ts     # Supabase Auth 回调
│   ├── (dashboard)/
│   │   ├── layout.tsx            # 需要登录的布局
│   │   ├── subscription/page.tsx # 创建/编辑订阅
│   │   └── result/page.tsx       # 查看最新结果
│   ├── api/
│   │   ├── subscription/route.ts # 订阅 CRUD
│   │   ├── run/route.ts          # 手动触发 + 流式响应
│   │   ├── cron/route.ts         # Vercel Cron 入口
│   │   └── auth/
│   │       └── verify-turnstile/route.ts
│   ├── layout.tsx
│   └── page.tsx                  # 首页 (重定向)
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # 浏览器客户端
│   │   ├── server.ts             # 服务端客户端
│   │   └── admin.ts              # Admin 客户端 (绕过 RLS)
│   ├── agent/
│   │   ├── pipeline.ts           # Pipeline 主流程
│   │   ├── scout.ts
│   │   ├── judge.ts
│   │   ├── analyst.ts
│   │   └── editor.ts
│   └── gemini.ts
├── vercel.json
└── ...
```

## 数据模型

### subscriptions 表

```sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  topic_intent text not null,
  time_window text not null check (time_window in ('3d', '7d', '30d')),
  output_mode text not null check (output_mode in ('brief', 'report')),
  frequency text not null check (frequency in ('once', 'daily', 'weekly', 'monthly')),
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id)
);
```

### artifacts 表

```sql
create table artifacts (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references subscriptions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  content jsonb not null,
  pipeline_log jsonb,
  created_at timestamptz default now()
);
```

### RLS 策略

```sql
alter table subscriptions enable row level security;
alter table artifacts enable row level security;

create policy "用户只能访问自己的订阅"
  on subscriptions for all using (auth.uid() = user_id);

create policy "用户只能访问自己的结果"
  on artifacts for all using (auth.uid() = user_id);
```

## Artifact 内容结构

```typescript
interface ArtifactContent {
  meta: {
    topicIntent: string;
    timeWindow: '3d' | '7d' | '30d';
    outputMode: 'brief' | 'report';
    generatedAt: string;
  };

  sources: Array<{
    title: string;
    url: string;
    author: string;
    publishedAt: string;
    sourceType: 'youtube' | 'blog' | 'official';
    summary: string;
    kept: boolean;
    reason?: string;
  }>;

  insights: Array<{
    headline: string;
    significance: string;
    isNovelty: boolean;
    confidence: 'high' | 'medium' | 'low';
  }>;

  output: {
    title: string;
    body: string;
    agentStatement: string;
    uncertainties: string[];
  };
}
```

## Agent Pipeline

### 架构

```
Scout → Judge → Analyst → Editor
```

### Pipeline 主流程

```typescript
export async function runPipeline(
  input: PipelineInput,
  callbacks?: PipelineCallbacks
): Promise<ArtifactContent> {

  callbacks?.onStageStart('scout');
  const scoutResult = await scout(input.topicIntent, input.timeWindow);
  callbacks?.onStageComplete('scout', scoutResult);

  callbacks?.onStageStart('judge');
  const judgeResult = await judge(scoutResult.sources, input.topicIntent);
  callbacks?.onStageComplete('judge', judgeResult);

  callbacks?.onStageStart('analyst');
  const analystResult = await analyst(judgeResult.keptSources, input.topicIntent);
  callbacks?.onStageComplete('analyst', analystResult);

  callbacks?.onStageStart('editor');
  const editorResult = await editor(analystResult.insights, input.outputMode);
  callbacks?.onStageComplete('editor', editorResult);

  return {
    meta: { ...input, generatedAt: new Date().toISOString() },
    sources: judgeResult.allSources,
    insights: analystResult.insights,
    output: editorResult
  };
}
```

### Scout 阶段

- 使用 Gemini Grounding with Google Search
- 根据 topicIntent + timeWindow 生成搜索策略
- 输出 8-15 个候选内容

### Judge 阶段

- 评估相关性、时效性、可信度、深度
- 去重（同事件保留最有深度的 1-2 篇）
- 输出 3-8 个高质量内容

### Analyst 阶段

- 关联多来源寻找共同信号
- 对每个发现回答：发生了什么、为什么重要、新变化还是噪音
- 输出 2-5 个核心洞察

### Editor 阶段

- 两种模式：brief (200字) / report (800-1200字)
- 风格要求：像人写的，有观点，敢判断
- 必含：agentStatement、uncertainties

## 触发机制

### 手动触发 (创建/编辑时)

- 使用 Server-Sent Events 流式反馈进度
- 前端实时显示阶段状态
- 完成后自动跳转结果页

### 定时触发 (Cron)

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 8 * * *"
    }
  ]
}
```

- 查询 `next_run_at <= now()` 的订阅
- 排除 `frequency = 'once'` 的订阅
- 执行后更新 `last_run_at` 和 `next_run_at`

## 认证流程

1. 用户输入邮箱
2. Turnstile 验证通过
3. Supabase 发送 Magic Link
4. 用户点击链接跳转 `/auth/callback`
5. 设置 session，跳转 dashboard

## 环境变量

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Gemini
GEMINI_API_KEY=

# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Vercel Cron (自动注入)
CRON_SECRET=
```

## 依赖

```json
{
  "dependencies": {
    "next": "^14",
    "@supabase/supabase-js": "^2",
    "@google/generative-ai": "^0.21",
    "@marsidev/react-turnstile": "^0.6",
    "react-markdown": "^9"
  }
}
```

## MVP 边界

### 包含

- Magic Link 登录 + Turnstile
- 每用户 1 个订阅，可编辑
- 频率配置：单次/每天/每周/每月
- 4 阶段 Agent Pipeline
- Gemini Grounding 内容检索
- 流式进度反馈
- Vercel Cron 定时执行
- 结果存储与展示

### 不包含 (TODO)

- 多订阅支持
- 历史结果列表与对比
- 邮件/Webhook 通知
- 自定义内容源列表
- 多语言输出
- 结果导出 (PDF/Markdown)
- 用量统计与配额
- 失败重试机制
- 团队协作/分享
