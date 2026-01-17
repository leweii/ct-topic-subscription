'use client';

export const dynamic = 'force-dynamic';

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
