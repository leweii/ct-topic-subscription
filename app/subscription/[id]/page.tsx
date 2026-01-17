'use client';

export const dynamic = 'force-dynamic';

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
              ←
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
