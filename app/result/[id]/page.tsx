'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/context';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import type { Artifact } from '@/lib/types';

export default function ResultPage({ params }: { params: { id: string } }) {
  const subscriptionId = params.id;
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
