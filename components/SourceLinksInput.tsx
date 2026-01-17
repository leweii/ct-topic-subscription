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
