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
