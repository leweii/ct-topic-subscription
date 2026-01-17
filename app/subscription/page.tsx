'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/context';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import type { Subscription, TimeWindow, OutputMode, Frequency } from '@/lib/types';

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState('');
  const [saving, setSaving] = useState(false);
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
    setStage(t('pipeline.starting'));

    try {
      const response = await fetch('/api/run', {
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
      setStage(t('pipeline.error'));
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
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">
            {subscription ? t('subscription.edit') : t('subscription.create')}
          </h1>
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
              defaultValue={subscription?.topic_intent || ''}
              placeholder={t('subscription.topicPlaceholder')}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="timeWindow" className="block text-sm font-medium text-gray-700 mb-1">
                {t('subscription.timeWindow')}
              </label>
              <select
                id="timeWindow"
                name="timeWindow"
                defaultValue={subscription?.time_window || '7d'}
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
                defaultValue={subscription?.output_mode || 'brief'}
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
                defaultValue={subscription?.frequency || 'once'}
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
            disabled={running || saving}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
          >
            {running ? stage : saving ? t('subscription.saving') : subscription ? t('subscription.saveRun') : t('subscription.createRun')}
          </button>
        </form>

        {subscription?.last_run_at && (
          <div className="mt-4 text-center">
            <a href="/result" className="text-blue-600 hover:underline">
              {t('subscription.viewResult')} →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
