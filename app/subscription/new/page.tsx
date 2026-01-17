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
