# Multi-Subscription with Source Links Design

## Overview

Enable users to create multiple subscriptions, each with optional source links (YouTuber channels, blogs) as supplementary information sources.

## Requirements

- Users can create multiple subscriptions (currently limited to one)
- Each subscription can have multiple source links (one-to-many)
- Links store URL only (system auto-detects type)
- Each subscription is independent
- Link limits based on plan: free users 5, paid users unlimited (future)

## Database Schema Changes

### 1. Remove unique constraint on subscriptions

```sql
ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_user_id_key;
```

### 2. New subscription_links table

```sql
CREATE TABLE public.subscription_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE(subscription_id, url)  -- No duplicate URLs within same subscription
);

-- RLS policy (access through subscription's user_id)
ALTER TABLE public.subscription_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscription links"
  ON public.subscription_links FOR ALL
  USING (
    subscription_id IN (
      SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
    )
  );

-- Index
CREATE INDEX idx_subscription_links_subscription_id
  ON public.subscription_links(subscription_id);
```

## API Design

### Subscription endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/subscriptions | List all user subscriptions |
| POST | /api/subscriptions | Create new subscription |
| PUT | /api/subscriptions/[id] | Update subscription |
| DELETE | /api/subscriptions/[id] | Delete subscription |

### Link management endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/subscriptions/[id]/links | Add link to subscription |
| DELETE | /api/subscriptions/[id]/links/[linkId] | Remove link |

### Link limit logic

```typescript
const LINK_LIMITS = {
  free: 5,
  pro: Infinity  // Future use
};

// Check before creating link
const currentCount = await getLinksCount(subscriptionId);
if (currentCount >= LINK_LIMITS[userPlan]) {
  throw new Error('Link limit reached');
}
```

## Frontend UI

### 1. Subscription list page (new)

Route: `/subscriptions`

- Display all subscriptions as cards
- Each card shows: topic summary, link count, last run time
- "+ New subscription" button
- Click card to edit

### 2. Subscription edit page

Route: `/subscription/[id]` or `/subscription/new`

Existing fields unchanged:
- Research intent (topic_intent)
- Time window, output mode, frequency

New "Sources" section:
```
Sources (optional)
┌─────────────────────────────────────┐
│ https://youtube.com/@channel1    ✕ │
│ https://example.com/blog         ✕ │
├─────────────────────────────────────┤
│ [Enter URL...]              [Add]  │
└─────────────────────────────────────┘
2/5 sources added
```

### 3. i18n additions

```json
// en.json
"subscription": {
  "sources": "Sources (optional)",
  "addSource": "Add",
  "sourcePlaceholder": "Enter YouTube or blog URL",
  "sourceLimit": "{count}/{max} sources added",
  "sourceLimitReached": "Source limit reached"
}

// zh.json
"subscription": {
  "sources": "信息源（可选）",
  "addSource": "添加",
  "sourcePlaceholder": "输入 YouTube 或博客链接",
  "sourceLimit": "已添加 {count}/{max} 个链接",
  "sourceLimitReached": "链接数量已达上限"
}
```

## Files to Change

```
supabase/
  schema.sql                    # Add subscription_links table

lib/
  supabase.ts                   # Add link-related database functions

app/
  api/
    subscriptions/
      route.ts                  # Return list instead of single
      [id]/
        route.ts                # New: single subscription CRUD
        links/
          route.ts              # New: link management API
          [linkId]/
            route.ts            # New: delete single link

  subscriptions/
    page.tsx                    # New: subscription list page

  subscription/
    [id]/
      page.tsx                  # New: edit specific subscription
    new/
      page.tsx                  # Can reuse existing subscription/page.tsx
    page.tsx                    # Redirect to list or new

components/
  SourceLinksInput.tsx          # New: link input component

lib/i18n/locales/
  en.json                       # Add translations
  zh.json                       # Add translations
```

## Implementation Order

1. **Database** - Execute schema changes
2. **API** - Implement backend endpoints
3. **Components** - Build SourceLinksInput component
4. **Pages** - Update subscription pages, add list page
5. **i18n** - Add translations
