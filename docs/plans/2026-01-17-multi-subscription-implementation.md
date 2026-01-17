# Multi-Subscription with Source Links Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to create multiple subscriptions, each with optional source links (YouTuber/blog URLs).

**Architecture:** Add `subscription_links` table with one-to-many relationship to subscriptions. Remove unique constraint on user_id. Create new API routes for CRUD operations. Add link management UI component.

**Tech Stack:** Next.js 14, Supabase (PostgreSQL), TypeScript, Tailwind CSS

---

## Task 1: Update Database Schema

**Files:**
- Modify: `supabase/schema.sql`

**Step 1: Add subscription_links table and remove unique constraint**

Add to `supabase/schema.sql`:

```sql
-- Remove unique constraint on user_id (allows multiple subscriptions per user)
-- Run this in Supabase SQL editor:
-- ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_key;

-- Subscription links table
create table if not exists public.subscription_links (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete cascade not null,
  url text not null,
  created_at timestamptz default now() not null,

  unique(subscription_id, url)
);

-- Enable RLS
alter table public.subscription_links enable row level security;

-- RLS Policy (access through subscription's user_id)
create policy "Users can view own subscription links"
  on public.subscription_links for select
  using (
    subscription_id in (
      select id from public.subscriptions where user_id = auth.uid()
    )
  );

create policy "Users can insert own subscription links"
  on public.subscription_links for insert
  with check (
    subscription_id in (
      select id from public.subscriptions where user_id = auth.uid()
    )
  );

create policy "Users can delete own subscription links"
  on public.subscription_links for delete
  using (
    subscription_id in (
      select id from public.subscriptions where user_id = auth.uid()
    )
  );

-- Index
create index if not exists idx_subscription_links_subscription_id
  on public.subscription_links(subscription_id);
```

**Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): add subscription_links table and update schema"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `lib/types.ts`

**Step 1: Add SubscriptionLink type and update Subscription**

Add to `lib/types.ts`:

```typescript
export interface SubscriptionLink {
  id: string;
  subscription_id: string;
  url: string;
  created_at: string;
}

export interface SubscriptionWithLinks extends Subscription {
  subscription_links?: SubscriptionLink[];
}
```

**Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): add SubscriptionLink interface"
```

---

## Task 3: Create Subscriptions List API

**Files:**
- Create: `app/api/subscriptions/route.ts`

**Step 1: Implement GET (list) and POST (create) endpoints**

Create `app/api/subscriptions/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { TimeWindow, OutputMode, Frequency } from '@/lib/types';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, subscription_links(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const payload = {
    user_id: user.id,
    topic_intent: body.topic_intent as string,
    time_window: (body.time_window || '7d') as TimeWindow,
    output_mode: (body.output_mode || 'brief') as OutputMode,
    frequency: (body.frequency || 'once') as Frequency,
  };

  const { data, error } = await supabase
    .from('subscriptions')
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
```

**Step 2: Verify endpoint works**

```bash
# Start dev server and test with curl or browser
npm run dev
```

**Step 3: Commit**

```bash
git add app/api/subscriptions/route.ts
git commit -m "feat(api): add subscriptions list and create endpoints"
```

---

## Task 4: Create Single Subscription API

**Files:**
- Create: `app/api/subscriptions/[id]/route.ts`

**Step 1: Implement GET, PUT, DELETE for single subscription**

Create `app/api/subscriptions/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { TimeWindow, OutputMode, Frequency } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, subscription_links(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const payload: Record<string, unknown> = {};

  if (body.topic_intent) payload.topic_intent = body.topic_intent;
  if (body.time_window) payload.time_window = body.time_window as TimeWindow;
  if (body.output_mode) payload.output_mode = body.output_mode as OutputMode;
  if (body.frequency) payload.frequency = body.frequency as Frequency;

  const { data, error } = await supabase
    .from('subscriptions')
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add app/api/subscriptions/[id]/route.ts
git commit -m "feat(api): add single subscription CRUD endpoints"
```

---

## Task 5: Create Subscription Links API

**Files:**
- Create: `app/api/subscriptions/[id]/links/route.ts`

**Step 1: Implement POST (add link) endpoint**

Create `app/api/subscriptions/[id]/links/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LINK_LIMITS = {
  free: 5,
  pro: Infinity,
};

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: subscriptionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify subscription belongs to user
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .single();

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  // Check link count limit
  const { count } = await supabase
    .from('subscription_links')
    .select('*', { count: 'exact', head: true })
    .eq('subscription_id', subscriptionId);

  const userPlan = 'free'; // TODO: get from user profile
  if ((count || 0) >= LINK_LIMITS[userPlan]) {
    return NextResponse.json(
      { error: 'Link limit reached', limit: LINK_LIMITS[userPlan] },
      { status: 400 }
    );
  }

  const { url } = await request.json();

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('subscription_links')
    .insert({ subscription_id: subscriptionId, url })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'URL already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
```

**Step 2: Commit**

```bash
git add app/api/subscriptions/[id]/links/route.ts
git commit -m "feat(api): add subscription link creation endpoint"
```

---

## Task 6: Create Delete Link API

**Files:**
- Create: `app/api/subscriptions/[id]/links/[linkId]/route.ts`

**Step 1: Implement DELETE endpoint**

Create `app/api/subscriptions/[id]/links/[linkId]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string; linkId: string }>;
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id: subscriptionId, linkId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify subscription belongs to user
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .single();

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('subscription_links')
    .delete()
    .eq('id', linkId)
    .eq('subscription_id', subscriptionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add app/api/subscriptions/[id]/links/[linkId]/route.ts
git commit -m "feat(api): add subscription link deletion endpoint"
```

---

## Task 7: Add i18n Translations

**Files:**
- Modify: `lib/i18n/locales/en.json`
- Modify: `lib/i18n/locales/zh.json`

**Step 1: Add English translations**

Add to `lib/i18n/locales/en.json` in the `subscription` object:

```json
"sources": "Sources (optional)",
"addSource": "Add",
"sourcePlaceholder": "Enter YouTube or blog URL",
"sourceCount": "{count}/{max} sources",
"sourceLimitReached": "Source limit reached",
"deleteSubscription": "Delete",
"confirmDelete": "Are you sure you want to delete this subscription?",
"newSubscription": "New Subscription",
"subscriptionList": "My Subscriptions",
"noSubscriptions": "No subscriptions yet",
"createFirst": "Create your first subscription"
```

**Step 2: Add Chinese translations**

Add to `lib/i18n/locales/zh.json` in the `subscription` object:

```json
"sources": "信息源（可选）",
"addSource": "添加",
"sourcePlaceholder": "输入 YouTube 或博客链接",
"sourceCount": "已添加 {count}/{max} 个",
"sourceLimitReached": "链接数量已达上限",
"deleteSubscription": "删除",
"confirmDelete": "确定要删除此订阅吗？",
"newSubscription": "新建订阅",
"subscriptionList": "我的订阅",
"noSubscriptions": "暂无订阅",
"createFirst": "创建你的第一个订阅"
```

**Step 3: Commit**

```bash
git add lib/i18n/locales/en.json lib/i18n/locales/zh.json
git commit -m "feat(i18n): add translations for multi-subscription feature"
```

---

## Task 8: Create SourceLinksInput Component

**Files:**
- Create: `components/SourceLinksInput.tsx`

**Step 1: Implement the component**

Create `components/SourceLinksInput.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import type { SubscriptionLink } from '@/lib/types';

interface SourceLinksInputProps {
  subscriptionId?: string;
  links: SubscriptionLink[];
  onLinksChange: (links: SubscriptionLink[]) => void;
  maxLinks?: number;
  disabled?: boolean;
}

export function SourceLinksInput({
  subscriptionId,
  links,
  onLinksChange,
  maxLinks = 5,
  disabled = false,
}: SourceLinksInputProps) {
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useLanguage();

  const canAddMore = links.length < maxLinks;

  async function handleAdd() {
    if (!inputUrl.trim() || !canAddMore) return;

    setError('');
    setLoading(true);

    try {
      // Validate URL
      new URL(inputUrl);
    } catch {
      setError('Invalid URL');
      setLoading(false);
      return;
    }

    if (subscriptionId) {
      // If we have a subscription ID, save to API
      const res = await fetch(`/api/subscriptions/${subscriptionId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to add link');
        setLoading(false);
        return;
      }

      const newLink = await res.json();
      onLinksChange([...links, newLink]);
    } else {
      // For new subscriptions, just add to local state
      const newLink: SubscriptionLink = {
        id: `temp-${Date.now()}`,
        subscription_id: '',
        url: inputUrl,
        created_at: new Date().toISOString(),
      };
      onLinksChange([...links, newLink]);
    }

    setInputUrl('');
    setLoading(false);
  }

  async function handleRemove(linkId: string) {
    if (subscriptionId && !linkId.startsWith('temp-')) {
      // If saved link, delete from API
      await fetch(`/api/subscriptions/${subscriptionId}/links/${linkId}`, {
        method: 'DELETE',
      });
    }
    onLinksChange(links.filter((l) => l.id !== linkId));
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        {t('subscription.sources')}
      </label>

      {/* Existing links */}
      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-2"
            >
              <span className="flex-1 text-sm text-gray-700 truncate">
                {link.url}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(link.id)}
                disabled={disabled}
                className="text-gray-400 hover:text-red-500 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new link */}
      {canAddMore ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder={t('subscription.sourcePlaceholder')}
            disabled={disabled || loading}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={disabled || loading || !inputUrl.trim()}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-md transition-colors"
          >
            {t('subscription.addSource')}
          </button>
        </div>
      ) : (
        <p className="text-sm text-amber-600">{t('subscription.sourceLimitReached')}</p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <p className="text-xs text-gray-500">
        {t('subscription.sourceCount')
          .replace('{count}', String(links.length))
          .replace('{max}', String(maxLinks))}
      </p>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/SourceLinksInput.tsx
git commit -m "feat(ui): add SourceLinksInput component"
```

---

## Task 9: Create Subscriptions List Page

**Files:**
- Create: `app/subscriptions/page.tsx`

**Step 1: Implement the list page**

Create `app/subscriptions/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/context';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import type { SubscriptionWithLinks } from '@/lib/types';

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithLinks[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  useEffect(() => {
    loadSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSubscriptions() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const res = await fetch('/api/subscriptions');
    if (res.ok) {
      const data = await res.json();
      setSubscriptions(data);
    }
    setLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">{t('subscription.subscriptionList')}</h1>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <button
              onClick={handleSignOut}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              {t('subscription.signOut')}
            </button>
          </div>
        </div>

        {/* New Subscription Button */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/subscription/new')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            + {t('subscription.newSubscription')}
          </button>
        </div>

        {/* Subscriptions List */}
        {subscriptions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 mb-4">{t('subscription.noSubscriptions')}</p>
            <button
              onClick={() => router.push('/subscription/new')}
              className="text-blue-600 hover:underline"
            >
              {t('subscription.createFirst')}
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                onClick={() => router.push(`/subscription/${sub.id}`)}
                className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                      {sub.topic_intent}
                    </h3>
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span>{t(`subscription.timeOptions.${sub.time_window}`)}</span>
                      <span>{t(`subscription.outputOptions.${sub.output_mode}`)}</span>
                      <span>{t(`subscription.frequencyOptions.${sub.frequency}`)}</span>
                    </div>
                    {sub.subscription_links && sub.subscription_links.length > 0 && (
                      <p className="mt-2 text-sm text-gray-400">
                        {sub.subscription_links.length} {t('subscription.sources').replace(' (optional)', '').replace('（可选）', '')}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-400">
                    {sub.last_run_at && (
                      <p>{new Date(sub.last_run_at).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/subscriptions/page.tsx
git commit -m "feat(ui): add subscriptions list page"
```

---

## Task 10: Create Subscription Edit Page

**Files:**
- Create: `app/subscription/[id]/page.tsx`

**Step 1: Implement the edit page**

Create `app/subscription/[id]/page.tsx`:

```typescript
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/context';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SourceLinksInput } from '@/components/SourceLinksInput';
import type { SubscriptionWithLinks, SubscriptionLink, TimeWindow, OutputMode, Frequency } from '@/lib/types';

export default function EditSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [subscription, setSubscription] = useState<SubscriptionWithLinks | null>(null);
  const [links, setLinks] = useState<SubscriptionLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState('');
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { t, language } = useLanguage();

  const STAGE_LABELS: Record<string, string> = {
    scout: t('pipeline.searching'),
    judge: t('pipeline.filtering'),
    analyst: t('pipeline.analyzing'),
    editor: t('pipeline.writing'),
  };

  useEffect(() => {
    loadSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadSubscription() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const res = await fetch(`/api/subscriptions/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSubscription(data);
      setLinks(data.subscription_links || []);
    } else {
      router.push('/subscriptions');
    }
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

    await fetch(`/api/subscriptions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    await runAgent();
  }

  async function runAgent() {
    setRunning(true);
    setStage(t('pipeline.starting'));

    try {
      const response = await fetch(`/api/subscriptions/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
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
              router.push(`/result/${id}`);
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
      setStage(t('pipeline.error'));
    }

    setRunning(false);
  }

  async function handleDelete() {
    if (!confirm(t('subscription.confirmDelete'))) return;

    setDeleting(true);
    await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
    router.push('/subscriptions');
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  if (!subscription) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/subscriptions')}
              className="text-gray-500 hover:text-gray-700"
            >
              ← {t('result.back').replace('subscription', t('subscription.subscriptionList'))}
            </button>
            <h1 className="text-2xl font-bold">{t('subscription.edit')}</h1>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <button
              onClick={handleSignOut}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              {t('subscription.signOut')}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <label htmlFor="topicIntent" className="block text-sm font-medium text-gray-700 mb-1">
              {t('subscription.topicLabel')}
            </label>
            <textarea
              id="topicIntent"
              name="topicIntent"
              rows={3}
              defaultValue={subscription.topic_intent}
              placeholder={t('subscription.topicPlaceholder')}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <SourceLinksInput
            subscriptionId={id}
            links={links}
            onLinksChange={setLinks}
            maxLinks={5}
            disabled={running || saving}
          />

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="timeWindow" className="block text-sm font-medium text-gray-700 mb-1">
                {t('subscription.timeWindow')}
              </label>
              <select
                id="timeWindow"
                name="timeWindow"
                defaultValue={subscription.time_window}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="3d">{t('subscription.timeOptions.3d')}</option>
                <option value="7d">{t('subscription.timeOptions.7d')}</option>
                <option value="30d">{t('subscription.timeOptions.30d')}</option>
              </select>
            </div>

            <div>
              <label htmlFor="outputMode" className="block text-sm font-medium text-gray-700 mb-1">
                {t('subscription.outputMode')}
              </label>
              <select
                id="outputMode"
                name="outputMode"
                defaultValue={subscription.output_mode}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="brief">{t('subscription.outputOptions.brief')}</option>
                <option value="report">{t('subscription.outputOptions.report')}</option>
              </select>
            </div>

            <div>
              <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-1">
                {t('subscription.frequency')}
              </label>
              <select
                id="frequency"
                name="frequency"
                defaultValue={subscription.frequency}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="once">{t('subscription.frequencyOptions.once')}</option>
                <option value="daily">{t('subscription.frequencyOptions.daily')}</option>
                <option value="weekly">{t('subscription.frequencyOptions.weekly')}</option>
                <option value="monthly">{t('subscription.frequencyOptions.monthly')}</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={running || saving || deleting}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
            >
              {running ? stage : saving ? t('subscription.saving') : t('subscription.saveRun')}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={running || saving || deleting}
              className="py-3 px-4 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-600 font-medium rounded-md transition-colors"
            >
              {t('subscription.deleteSubscription')}
            </button>
          </div>
        </form>

        {subscription.last_run_at && (
          <div className="mt-4 text-center">
            <a href={`/result/${id}`} className="text-blue-600 hover:underline">
              {t('subscription.viewResult')} →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/subscription/[id]/page.tsx
git commit -m "feat(ui): add subscription edit page"
```

---

## Task 11: Create New Subscription Page

**Files:**
- Create: `app/subscription/new/page.tsx`

**Step 1: Implement the new subscription page**

Create `app/subscription/new/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/context';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SourceLinksInput } from '@/components/SourceLinksInput';
import type { SubscriptionLink, TimeWindow, OutputMode, Frequency } from '@/lib/types';

export default function NewSubscriptionPage() {
  const [links, setLinks] = useState<SubscriptionLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
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

    // Create subscription
    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setSaving(false);
      return;
    }

    const subscription = await res.json();

    // Add links if any
    for (const link of links) {
      await fetch(`/api/subscriptions/${subscription.id}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link.url }),
      });
    }

    // Navigate to edit page to run
    router.push(`/subscription/${subscription.id}`);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/subscriptions')}
              className="text-gray-500 hover:text-gray-700"
            >
              ←
            </button>
            <h1 className="text-2xl font-bold">{t('subscription.newSubscription')}</h1>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <button
              onClick={handleSignOut}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              {t('subscription.signOut')}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <label htmlFor="topicIntent" className="block text-sm font-medium text-gray-700 mb-1">
              {t('subscription.topicLabel')}
            </label>
            <textarea
              id="topicIntent"
              name="topicIntent"
              rows={3}
              placeholder={t('subscription.topicPlaceholder')}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <SourceLinksInput
            links={links}
            onLinksChange={setLinks}
            maxLinks={5}
            disabled={saving}
          />

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="timeWindow" className="block text-sm font-medium text-gray-700 mb-1">
                {t('subscription.timeWindow')}
              </label>
              <select
                id="timeWindow"
                name="timeWindow"
                defaultValue="7d"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="3d">{t('subscription.timeOptions.3d')}</option>
                <option value="7d">{t('subscription.timeOptions.7d')}</option>
                <option value="30d">{t('subscription.timeOptions.30d')}</option>
              </select>
            </div>

            <div>
              <label htmlFor="outputMode" className="block text-sm font-medium text-gray-700 mb-1">
                {t('subscription.outputMode')}
              </label>
              <select
                id="outputMode"
                name="outputMode"
                defaultValue="brief"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="brief">{t('subscription.outputOptions.brief')}</option>
                <option value="report">{t('subscription.outputOptions.report')}</option>
              </select>
            </div>

            <div>
              <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-1">
                {t('subscription.frequency')}
              </label>
              <select
                id="frequency"
                name="frequency"
                defaultValue="once"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="once">{t('subscription.frequencyOptions.once')}</option>
                <option value="daily">{t('subscription.frequencyOptions.daily')}</option>
                <option value="weekly">{t('subscription.frequencyOptions.weekly')}</option>
                <option value="monthly">{t('subscription.frequencyOptions.monthly')}</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
          >
            {saving ? t('subscription.saving') : t('subscription.createRun')}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/subscription/new/page.tsx
git commit -m "feat(ui): add new subscription page"
```

---

## Task 12: Create Run API for Specific Subscription

**Files:**
- Create: `app/api/subscriptions/[id]/run/route.ts`

**Step 1: Implement the run endpoint**

Create `app/api/subscriptions/[id]/run/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runPipeline } from '@/lib/agent/pipeline';
import { calculateNextRun } from '@/lib/utils';
import type { TimeWindow, OutputMode, Frequency, Language } from '@/lib/types';

export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: subscriptionId } = await params;
  const { language = 'en' } = await request.json().catch(() => ({})) as { language?: Language };
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, subscription_links(*)')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .single();

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
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
            language,
            // TODO: Pass source links to pipeline when implemented
            // sourceLinks: subscription.subscription_links?.map((l: { url: string }) => l.url) || [],
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

```bash
git add app/api/subscriptions/[id]/run/route.ts
git commit -m "feat(api): add run endpoint for specific subscription"
```

---

## Task 13: Update Result Page for Subscription ID

**Files:**
- Create: `app/result/[id]/page.tsx`

**Step 1: Implement the result page with subscription ID**

Create `app/result/[id]/page.tsx`:

```typescript
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/context';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import type { Artifact } from '@/lib/types';

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: subscriptionId } = use(params);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  useEffect(() => {
    loadResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionId]);

  async function loadResult() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data } = await supabase
      .from('artifacts')
      .select('*')
      .eq('subscription_id', subscriptionId)
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
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="absolute top-4 right-4">
            <LanguageSwitcher />
          </div>
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">{t('result.noResults')}</p>
            <a
              href={`/subscription/${subscriptionId}`}
              className="text-blue-600 hover:underline"
            >
              ← {t('result.back')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { content } = artifact;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>

        <div className="mb-6">
          <a
            href={`/subscription/${subscriptionId}`}
            className="text-blue-600 hover:underline"
          >
            ← {t('result.back')}
          </a>
        </div>

        <article className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold mb-6">{content.output.title}</h1>

          <div
            className="prose prose-gray max-w-none mb-8"
            dangerouslySetInnerHTML={{ __html: content.output.body.replace(/\n/g, '<br />') }}
          />

          {content.output.uncertainties.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
              <h3 className="font-semibold text-amber-800 mb-2">
                {t('result.pointsToWatch')}
              </h3>
              <ul className="list-disc list-inside text-amber-700 space-y-1">
                {content.output.uncertainties.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t pt-6">
            <h3 className="font-semibold text-gray-700 mb-3">{t('result.sources')}</h3>
            <div className="space-y-2">
              {content.sources
                .filter((s) => s.kept)
                .map((source, i) => (
                  <a
                    key={i}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-600 hover:underline truncate"
                  >
                    {source.title} - {source.author}
                  </a>
                ))}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/result/[id]/page.tsx
git commit -m "feat(ui): add result page with subscription ID"
```

---

## Task 14: Update Redirects

**Files:**
- Modify: `app/subscription/page.tsx`
- Modify: `app/page.tsx`

**Step 1: Update subscription/page.tsx to redirect to list**

Replace `app/subscription/page.tsx`:

```typescript
import { redirect } from 'next/navigation';

export default function SubscriptionPage() {
  redirect('/subscriptions');
}
```

**Step 2: Update app/page.tsx to redirect to subscriptions**

Modify `app/page.tsx` to redirect to `/subscriptions` instead of `/subscription`:

```typescript
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/subscriptions');
}
```

**Step 3: Commit**

```bash
git add app/subscription/page.tsx app/page.tsx
git commit -m "feat(routing): update redirects for multi-subscription"
```

---

## Task 15: Final Verification and Cleanup

**Step 1: Run lint check**

```bash
npm run lint
```

**Step 2: Run build**

```bash
npm run build
```

**Step 3: Fix any errors that appear**

**Step 4: Final commit if needed**

```bash
git add -A
git commit -m "fix: resolve build issues"
```

---

## Summary

Implementation order:
1. Database schema (Task 1)
2. TypeScript types (Task 2)
3. Subscriptions list API (Task 3)
4. Single subscription API (Task 4)
5. Links API - create (Task 5)
6. Links API - delete (Task 6)
7. i18n translations (Task 7)
8. SourceLinksInput component (Task 8)
9. Subscriptions list page (Task 9)
10. Subscription edit page (Task 10)
11. New subscription page (Task 11)
12. Run API for specific subscription (Task 12)
13. Result page with subscription ID (Task 13)
14. Update redirects (Task 14)
15. Final verification (Task 15)

**Note:** After completing these tasks, you need to manually run the SQL migration in Supabase to:
1. Remove the unique constraint: `ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_key;`
2. Create the `subscription_links` table with the SQL from Task 1
