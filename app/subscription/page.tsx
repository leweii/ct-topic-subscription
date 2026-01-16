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
