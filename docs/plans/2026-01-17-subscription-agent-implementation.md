# Subscription Agent Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an MVP subscription-based cognitive agent platform that retrieves, analyzes, and summarizes high-quality content based on user-defined topics.

**Architecture:** Next.js App Router with Supabase (auth + database), Gemini AI for content analysis via Google Search grounding, and Cloudflare Turnstile for bot protection. Agent runs as a 4-stage pipeline (Scout → Judge → Analyst → Editor).

**Tech Stack:** Next.js 14, Supabase, Gemini API, Cloudflare Turnstile, Vercel Cron

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `.env.local.example`
- Create: `.gitignore`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `app/globals.css`

**Step 1: Initialize Next.js project**

Run:
```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

Expected: Project scaffolded with App Router

**Step 2: Install dependencies**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr @google/generative-ai @marsidev/react-turnstile react-markdown
```

Expected: Dependencies installed

**Step 3: Create environment example file**

Create `.env.local.example`:
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

# Vercel Cron (auto-injected in production)
CRON_SECRET=
```

**Step 4: Commit**

Run:
```bash
git add -A && git commit -m "feat: initialize Next.js project with dependencies"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `lib/types.ts`

**Step 1: Create type definitions**

Create `lib/types.ts`:
```typescript
export type TimeWindow = '3d' | '7d' | '30d';
export type OutputMode = 'brief' | 'report';
export type Frequency = 'once' | 'daily' | 'weekly' | 'monthly';
export type SourceType = 'youtube' | 'blog' | 'official';
export type Confidence = 'high' | 'medium' | 'low';

export interface Subscription {
  id: string;
  user_id: string;
  topic_intent: string;
  time_window: TimeWindow;
  output_mode: OutputMode;
  frequency: Frequency;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Source {
  title: string;
  url: string;
  author: string;
  publishedAt: string;
  sourceType: SourceType;
  summary: string;
  kept?: boolean;
  reason?: string;
}

export interface Insight {
  headline: string;
  significance: string;
  isNovelty: boolean;
  confidence: Confidence;
}

export interface ArtifactOutput {
  title: string;
  body: string;
  agentStatement: string;
  uncertainties: string[];
}

export interface ArtifactContent {
  meta: {
    topicIntent: string;
    timeWindow: TimeWindow;
    outputMode: OutputMode;
    generatedAt: string;
  };
  sources: Source[];
  insights: Insight[];
  output: ArtifactOutput;
}

export interface Artifact {
  id: string;
  subscription_id: string;
  user_id: string;
  content: ArtifactContent;
  pipeline_log?: Record<string, unknown>;
  created_at: string;
}

export interface PipelineInput {
  topicIntent: string;
  timeWindow: TimeWindow;
  outputMode: OutputMode;
}

export interface PipelineCallbacks {
  onStageStart?: (stage: string) => void;
  onStageComplete?: (stage: string, result: unknown) => void;
}
```

**Step 2: Commit**

Run:
```bash
git add lib/types.ts && git commit -m "feat: add TypeScript type definitions"
```

---

## Task 3: Supabase Clients

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`

**Step 1: Create browser client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Create server client**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  );
}
```

**Step 3: Create admin client**

Create `lib/supabase/admin.ts`:
```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
```

**Step 4: Create middleware helper**

Create `lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect to login if accessing dashboard without auth
  if (
    !user &&
    request.nextUrl.pathname.startsWith('/subscription') ||
    request.nextUrl.pathname.startsWith('/result')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if logged in and accessing login
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/subscription';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

**Step 5: Create middleware**

Create `middleware.ts`:
```typescript
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**Step 6: Commit**

Run:
```bash
git add lib/supabase middleware.ts && git commit -m "feat: add Supabase client utilities and auth middleware"
```

---

## Task 4: Database Schema

**Files:**
- Create: `supabase/schema.sql`

**Step 1: Create schema file**

Create `supabase/schema.sql`:
```sql
-- Subscriptions table
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  topic_intent text not null,
  time_window text not null check (time_window in ('3d', '7d', '30d')),
  output_mode text not null check (output_mode in ('brief', 'report')),
  frequency text not null check (frequency in ('once', 'daily', 'weekly', 'monthly')),
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  unique(user_id)
);

-- Artifacts table
create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content jsonb not null,
  pipeline_log jsonb,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.subscriptions enable row level security;
alter table public.artifacts enable row level security;

-- RLS Policies for subscriptions
create policy "Users can view own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert own subscriptions"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own subscriptions"
  on public.subscriptions for update
  using (auth.uid() = user_id);

create policy "Users can delete own subscriptions"
  on public.subscriptions for delete
  using (auth.uid() = user_id);

-- RLS Policies for artifacts
create policy "Users can view own artifacts"
  on public.artifacts for select
  using (auth.uid() = user_id);

create policy "Users can insert own artifacts"
  on public.artifacts for insert
  with check (auth.uid() = user_id);

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

-- Indexes
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_next_run_at on public.subscriptions(next_run_at);
create index if not exists idx_artifacts_user_id on public.artifacts(user_id);
create index if not exists idx_artifacts_subscription_id on public.artifacts(subscription_id);
create index if not exists idx_artifacts_created_at on public.artifacts(created_at desc);
```

**Step 2: Commit**

Run:
```bash
git add supabase/schema.sql && git commit -m "feat: add database schema for subscriptions and artifacts"
```

---

## Task 5: Gemini Client

**Files:**
- Create: `lib/gemini.ts`

**Step 1: Create Gemini client**

Create `lib/gemini.ts`:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const gemini = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
});

export const geminiWithSearch = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  tools: [{ googleSearch: {} } as any],
});

export async function generateWithSearch(prompt: string): Promise<string> {
  const result = await geminiWithSearch.generateContent(prompt);
  return result.response.text();
}

export async function generate(prompt: string): Promise<string> {
  const result = await gemini.generateContent(prompt);
  return result.response.text();
}

export function parseJsonResponse<T>(text: string): T {
  // Extract JSON from potential markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr);
}
```

**Step 2: Commit**

Run:
```bash
git add lib/gemini.ts && git commit -m "feat: add Gemini client with search grounding support"
```

---

## Task 6: Agent Pipeline - Scout

**Files:**
- Create: `lib/agent/scout.ts`

**Step 1: Create Scout module**

Create `lib/agent/scout.ts`:
```typescript
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
```

**Step 2: Commit**

Run:
```bash
git add lib/agent/scout.ts && git commit -m "feat: add Scout stage for content discovery"
```

---

## Task 7: Agent Pipeline - Judge

**Files:**
- Create: `lib/agent/judge.ts`

**Step 1: Create Judge module**

Create `lib/agent/judge.ts`:
```typescript
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
```

**Step 2: Commit**

Run:
```bash
git add lib/agent/judge.ts && git commit -m "feat: add Judge stage for content filtering"
```

---

## Task 8: Agent Pipeline - Analyst

**Files:**
- Create: `lib/agent/analyst.ts`

**Step 1: Create Analyst module**

Create `lib/agent/analyst.ts`:
```typescript
import { generate, parseJsonResponse } from '@/lib/gemini';
import type { Source, Insight } from '@/lib/types';

const ANALYST_PROMPT = `You are a senior industry analyst. Based on the filtered content, extract core insights.

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

Return ONLY the JSON array, no other text. Target: Extract 2-5 core insights.`;

export interface AnalystResult {
  insights: Insight[];
}

export async function analyst(
  keptSources: Source[],
  topicIntent: string
): Promise<AnalystResult> {
  const prompt = ANALYST_PROMPT
    .replace('{topicIntent}', topicIntent)
    .replace('{sourcesJson}', JSON.stringify(keptSources, null, 2));

  const response = await generate(prompt);
  const insights = parseJsonResponse<Insight[]>(response);

  return { insights };
}
```

**Step 2: Commit**

Run:
```bash
git add lib/agent/analyst.ts && git commit -m "feat: add Analyst stage for insight extraction"
```

---

## Task 9: Agent Pipeline - Editor

**Files:**
- Create: `lib/agent/editor.ts`

**Step 1: Create Editor module**

Create `lib/agent/editor.ts`:
```typescript
import { generate, parseJsonResponse } from '@/lib/gemini';
import type { Insight, ArtifactOutput, OutputMode } from '@/lib/types';

const EDITOR_PROMPT_BRIEF = `You are a professional tech editor. Transform analysis insights into a concise research brief.

## Insight Content
{insightsJson}

## Output Style
- Like a senior journalist writing a morning brief for executives, NOT an AI-generated summary
- Concise and powerful, one sentence per point
- Have opinions, dare to make judgments
- Avoid template expressions like "firstly, secondly, in conclusion"

## Output Format
Return JSON:
{
  "title": "Brief title (under 10 words, eye-catching)",
  "body": "Body text (Markdown, under 200 words, 3-5 points)",
  "agentStatement": "My judgment: ... (one sentence summarizing your core view)",
  "uncertainties": ["Point needing continued observation 1", "Uncertain point 2"]
}

Return ONLY the JSON, no other text.`;

const EDITOR_PROMPT_REPORT = `You are a professional tech editor. Transform analysis insights into a deep research report.

## Insight Content
{insightsJson}

## Output Style
- Like a top analyst's industry report, NOT an AI-generated summary
- Clear structure, sufficient evidence
- Clear stance and forward-looking judgments
- Professional but not obscure language

## Output Format
Return JSON:
{
  "title": "Report title (under 15 words)",
  "body": "Body text (Markdown, 800-1200 words, with subheadings)",
  "agentStatement": "Core judgment: ... (2-3 sentences elaborating your core view)",
  "uncertainties": ["Point needing continued observation 1", "Controversial point 2", "Insufficient data point 3"]
}

Return ONLY the JSON, no other text.`;

export async function editor(
  insights: Insight[],
  outputMode: OutputMode
): Promise<ArtifactOutput> {
  const promptTemplate = outputMode === 'brief' ? EDITOR_PROMPT_BRIEF : EDITOR_PROMPT_REPORT;
  const prompt = promptTemplate.replace('{insightsJson}', JSON.stringify(insights, null, 2));

  const response = await generate(prompt);
  return parseJsonResponse<ArtifactOutput>(response);
}
```

**Step 2: Commit**

Run:
```bash
git add lib/agent/editor.ts && git commit -m "feat: add Editor stage for final output generation"
```

---

## Task 10: Agent Pipeline - Main

**Files:**
- Create: `lib/agent/pipeline.ts`

**Step 1: Create Pipeline orchestrator**

Create `lib/agent/pipeline.ts`:
```typescript
import { scout } from './scout';
import { judge } from './judge';
import { analyst } from './analyst';
import { editor } from './editor';
import type { PipelineInput, PipelineCallbacks, ArtifactContent } from '@/lib/types';

export async function runPipeline(
  input: PipelineInput,
  callbacks?: PipelineCallbacks
): Promise<ArtifactContent> {
  // 1. Scout: Search for content using Gemini Grounding
  callbacks?.onStageStart?.('scout');
  const scoutResult = await scout(input.topicIntent, input.timeWindow);
  callbacks?.onStageComplete?.('scout', scoutResult);

  // 2. Judge: Filter and deduplicate
  callbacks?.onStageStart?.('judge');
  const judgeResult = await judge(scoutResult.sources, input.topicIntent);
  callbacks?.onStageComplete?.('judge', judgeResult);

  // 3. Analyst: Extract insights
  callbacks?.onStageStart?.('analyst');
  const analystResult = await analyst(judgeResult.keptSources, input.topicIntent);
  callbacks?.onStageComplete?.('analyst', analystResult);

  // 4. Editor: Generate final output
  callbacks?.onStageStart?.('editor');
  const editorResult = await editor(analystResult.insights, input.outputMode);
  callbacks?.onStageComplete?.('editor', editorResult);

  return {
    meta: {
      topicIntent: input.topicIntent,
      timeWindow: input.timeWindow,
      outputMode: input.outputMode,
      generatedAt: new Date().toISOString(),
    },
    sources: judgeResult.allSources,
    insights: analystResult.insights,
    output: editorResult,
  };
}
```

**Step 2: Commit**

Run:
```bash
git add lib/agent/pipeline.ts && git commit -m "feat: add Pipeline orchestrator"
```

---

## Task 11: Utility - Next Run Calculator

**Files:**
- Create: `lib/utils.ts`

**Step 1: Create utility functions**

Create `lib/utils.ts`:
```typescript
import type { Frequency } from './types';

export function calculateNextRun(frequency: Frequency): string | null {
  if (frequency === 'once') {
    return null;
  }

  const now = new Date();

  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      now.setHours(8, 0, 0, 0); // 8:00 AM next day
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      now.setHours(8, 0, 0, 0);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      now.setHours(8, 0, 0, 0);
      break;
  }

  return now.toISOString();
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
```

**Step 2: Commit**

Run:
```bash
git add lib/utils.ts && git commit -m "feat: add utility functions"
```

---

## Task 12: API - Turnstile Verification

**Files:**
- Create: `app/api/auth/verify-turnstile/route.ts`

**Step 1: Create Turnstile verification endpoint**

Create `app/api/auth/verify-turnstile/route.ts`:
```typescript
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          secret: process.env.TURNSTILE_SECRET_KEY!,
          response: token,
        }),
      }
    );

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

Run:
```bash
git add app/api/auth/verify-turnstile/route.ts && git commit -m "feat: add Turnstile verification API"
```

---

## Task 13: API - Run Pipeline

**Files:**
- Create: `app/api/run/route.ts`

**Step 1: Create streaming run endpoint**

Create `app/api/run/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runPipeline } from '@/lib/agent/pipeline';
import { calculateNextRun } from '@/lib/utils';
import type { TimeWindow, OutputMode, Frequency } from '@/lib/types';

export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!subscription) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const artifact = await runPipeline(
          {
            topicIntent: subscription.topic_intent,
            timeWindow: subscription.time_window as TimeWindow,
            outputMode: subscription.output_mode as OutputMode,
          },
          {
            onStageStart: (stage) => send({ type: 'stage_start', stage }),
            onStageComplete: (stage) => send({ type: 'stage_complete', stage }),
          }
        );

        // Store artifact
        const { error: insertError } = await supabase.from('artifacts').insert({
          subscription_id: subscription.id,
          user_id: user.id,
          content: artifact,
        });

        if (insertError) {
          throw insertError;
        }

        // Update subscription timestamps
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: calculateNextRun(subscription.frequency as Frequency),
          })
          .eq('id', subscription.id);

        if (updateError) {
          throw updateError;
        }

        send({ type: 'complete', artifact });
      } catch (error) {
        console.error('Pipeline error:', error);
        send({ type: 'error', message: (error as Error).message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Step 2: Commit**

Run:
```bash
git add app/api/run/route.ts && git commit -m "feat: add streaming pipeline run API"
```

---

## Task 14: API - Cron Handler

**Files:**
- Create: `app/api/cron/route.ts`
- Create: `vercel.json`

**Step 1: Create Cron endpoint**

Create `app/api/cron/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runPipeline } from '@/lib/agent/pipeline';
import { calculateNextRun } from '@/lib/utils';
import type { TimeWindow, OutputMode, Frequency } from '@/lib/types';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find all subscriptions due for execution
  const { data: subscriptions, error: fetchError } = await supabase
    .from('subscriptions')
    .select('*')
    .neq('frequency', 'once')
    .lte('next_run_at', new Date().toISOString());

  if (fetchError) {
    console.error('Error fetching subscriptions:', fetchError);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!subscriptions?.length) {
    return NextResponse.json({ message: 'No subscriptions to run', count: 0 });
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const sub of subscriptions) {
    try {
      const artifact = await runPipeline({
        topicIntent: sub.topic_intent,
        timeWindow: sub.time_window as TimeWindow,
        outputMode: sub.output_mode as OutputMode,
      });

      await supabase.from('artifacts').insert({
        subscription_id: sub.id,
        user_id: sub.user_id,
        content: artifact,
      });

      await supabase
        .from('subscriptions')
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: calculateNextRun(sub.frequency as Frequency),
        })
        .eq('id', sub.id);

      results.push({ id: sub.id, status: 'success' });
    } catch (error) {
      console.error(`Error running subscription ${sub.id}:`, error);
      results.push({
        id: sub.id,
        status: 'error',
        error: (error as Error).message,
      });
      // TODO: Implement retry mechanism / alerting
    }
  }

  return NextResponse.json({
    message: 'Cron complete',
    total: subscriptions.length,
    results,
  });
}
```

**Step 2: Create Vercel config**

Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 8 * * *"
    }
  ]
}
```

**Step 3: Commit**

Run:
```bash
git add app/api/cron/route.ts vercel.json && git commit -m "feat: add Cron handler for scheduled runs"
```

---

## Task 15: Auth - Callback Handler

**Files:**
- Create: `app/auth/callback/route.ts`

**Step 1: Create auth callback**

Create `app/auth/callback/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/subscription';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return to login on error
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

**Step 2: Commit**

Run:
```bash
git add app/auth/callback/route.ts && git commit -m "feat: add auth callback handler"
```

---

## Task 16: Pages - Login

**Files:**
- Create: `app/login/page.tsx`

**Step 1: Create login page**

Create `app/login/page.tsx`:
```tsx
'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Get Turnstile token
      const token = turnstileRef.current?.getResponse();
      if (!token) {
        setError('Please complete the verification');
        setLoading(false);
        return;
      }

      // Verify Turnstile token
      const verifyRes = await fetch('/api/auth/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!verifyRes.ok) {
        setError('Verification failed, please try again');
        turnstileRef.current?.reset();
        setLoading(false);
        return;
      }

      // Send Magic Link
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      setSent(true);
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-2xl font-bold mb-2">Check your email</h2>
          <p className="text-gray-600">
            We sent a login link to <strong>{email}</strong>
          </p>
          <p className="text-gray-500 text-sm mt-4">
            Click the link in the email to sign in
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Sign In</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
          >
            {loading ? 'Sending...' : 'Send login link'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

Run:
```bash
git add app/login/page.tsx && git commit -m "feat: add login page with Magic Link and Turnstile"
```

---

## Task 17: Pages - Subscription

**Files:**
- Create: `app/subscription/page.tsx`

**Step 1: Create subscription page**

Create `app/subscription/page.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Subscription, TimeWindow, OutputMode, Frequency } from '@/lib/types';

const STAGE_LABELS: Record<string, string> = {
  scout: 'Searching...',
  judge: 'Filtering...',
  analyst: 'Analyzing...',
  editor: 'Writing...',
};

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadSubscription();
  }, []);

  async function loadSubscription() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    setSubscription(data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      topic_intent: formData.get('topicIntent') as string,
      time_window: formData.get('timeWindow') as TimeWindow,
      output_mode: formData.get('outputMode') as OutputMode,
      frequency: formData.get('frequency') as Frequency,
    };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (subscription) {
      await supabase
        .from('subscriptions')
        .update(payload)
        .eq('id', subscription.id);
    } else {
      await supabase
        .from('subscriptions')
        .insert({ ...payload, user_id: user.id });
    }

    setSaving(false);
    await runAgent();
  }

  async function runAgent() {
    setRunning(true);
    setStage('Starting...');

    try {
      const response = await fetch('/api/run', { method: 'POST' });
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'stage_start') {
              setStage(STAGE_LABELS[data.stage] || data.stage);
            }

            if (data.type === 'complete') {
              router.push('/result');
              return;
            }

            if (data.type === 'error') {
              throw new Error(data.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('Run error:', error);
      setStage('Error occurred');
    }

    setRunning(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">
            {subscription ? 'Edit Subscription' : 'Create Subscription'}
          </h1>
          <button
            onClick={handleSignOut}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Sign out
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <label htmlFor="topicIntent" className="block text-sm font-medium text-gray-700 mb-1">
              Research Intent
            </label>
            <textarea
              id="topicIntent"
              name="topicIntent"
              rows={3}
              defaultValue={subscription?.topic_intent || ''}
              placeholder="Describe what you want to track, e.g., Latest developments in AI agents"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="timeWindow" className="block text-sm font-medium text-gray-700 mb-1">
                Time Window
              </label>
              <select
                id="timeWindow"
                name="timeWindow"
                defaultValue={subscription?.time_window || '7d'}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="3d">Past 3 days</option>
                <option value="7d">Past 7 days</option>
                <option value="30d">Past 30 days</option>
              </select>
            </div>

            <div>
              <label htmlFor="outputMode" className="block text-sm font-medium text-gray-700 mb-1">
                Output Mode
              </label>
              <select
                id="outputMode"
                name="outputMode"
                defaultValue={subscription?.output_mode || 'brief'}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="brief">Brief</option>
                <option value="report">Report</option>
              </select>
            </div>

            <div>
              <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-1">
                Frequency
              </label>
              <select
                id="frequency"
                name="frequency"
                defaultValue={subscription?.frequency || 'once'}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="once">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={running || saving}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
          >
            {running ? stage : saving ? 'Saving...' : subscription ? 'Save & Run' : 'Create & Run'}
          </button>
        </form>

        {subscription?.last_run_at && (
          <div className="mt-4 text-center">
            <a href="/result" className="text-blue-600 hover:underline">
              View latest result →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

Run:
```bash
git add app/subscription/page.tsx && git commit -m "feat: add subscription management page"
```

---

## Task 18: Pages - Result

**Files:**
- Create: `app/result/page.tsx`

**Step 1: Create result page**

Create `app/result/page.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ReactMarkdown from 'react-markdown';
import type { Artifact } from '@/lib/types';

export default function ResultPage() {
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadLatestArtifact();
  }, []);

  async function loadLatestArtifact() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data } = await supabase
      .from('artifacts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    setArtifact(data);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No analysis results yet</p>
          <a href="/subscription" className="text-blue-600 hover:underline">
            Create a subscription to get started →
          </a>
        </div>
      </div>
    );
  }

  const { content } = artifact;
  const keptSources = content.sources.filter((s) => s.kept);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-6">
          <a href="/subscription" className="text-blue-600 hover:underline text-sm">
            ← Back to subscription
          </a>
        </div>

        <article className="bg-white rounded-lg shadow-md p-8">
          {/* Header */}
          <header className="mb-6">
            <h1 className="text-3xl font-bold mb-2">{content.output.title}</h1>
            <time className="text-gray-500 text-sm">
              {new Date(content.meta.generatedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </header>

          {/* Body */}
          <div className="prose prose-lg max-w-none mb-8">
            <ReactMarkdown>{content.output.body}</ReactMarkdown>
          </div>

          {/* Agent Statement */}
          <blockquote className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r-md mb-6">
            <p className="text-blue-900 font-medium">{content.output.agentStatement}</p>
          </blockquote>

          {/* Uncertainties */}
          {content.output.uncertainties.length > 0 && (
            <section className="mb-8">
              <h3 className="text-lg font-semibold mb-3 text-gray-700">
                Points to Watch
              </h3>
              <ul className="space-y-2">
                {content.output.uncertainties.map((item, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-yellow-500 mr-2">⚠</span>
                    <span className="text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Sources */}
          <section className="border-t pt-6">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <span className="mr-2">{showSources ? '▼' : '▶'}</span>
              <span>Sources ({keptSources.length})</span>
            </button>

            {showSources && (
              <ul className="mt-4 space-y-4">
                {keptSources.map((source, i) => (
                  <li key={i} className="border-l-2 border-gray-200 pl-4">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {source.title}
                    </a>
                    <div className="text-sm text-gray-500 mt-1">
                      {source.author} · {source.publishedAt}
                      <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs">
                        {source.sourceType}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mt-1">{source.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </article>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

Run:
```bash
git add app/result/page.tsx && git commit -m "feat: add result display page"
```

---

## Task 19: Root Layout and Home Page

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

**Step 1: Update root layout**

Replace `app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Daily Report - AI Research Assistant',
  description: 'Subscribe to AI-powered research briefs on your topics of interest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

**Step 2: Update home page to redirect**

Replace `app/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/subscription');
  } else {
    redirect('/login');
  }
}
```

**Step 3: Commit**

Run:
```bash
git add app/layout.tsx app/page.tsx && git commit -m "feat: configure root layout and home redirect"
```

---

## Task 20: Final Configuration

**Files:**
- Update: `.gitignore`

**Step 1: Ensure proper gitignore**

Add to `.gitignore` if not present:
```
.env.local
.env*.local
```

**Step 2: Final commit**

Run:
```bash
git add .gitignore && git commit -m "chore: update gitignore for env files"
```

---

## Summary

After completing all tasks, you will have:

1. **Project Setup**: Next.js 14 with TypeScript, Tailwind CSS
2. **Database**: Supabase schema with RLS policies
3. **Auth**: Magic Link login with Turnstile protection
4. **Agent Pipeline**: 4-stage pipeline (Scout → Judge → Analyst → Editor)
5. **APIs**: Streaming run endpoint, Cron handler
6. **Pages**: Login, Subscription management, Result display
7. **Cron**: Daily scheduled runs via Vercel

**To deploy:**
1. Create Supabase project and run `supabase/schema.sql`
2. Create Cloudflare Turnstile widget
3. Get Gemini API key
4. Configure environment variables in Vercel
5. Deploy to Vercel
