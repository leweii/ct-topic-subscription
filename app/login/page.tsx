'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useLanguage } from '@/lib/i18n/context';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const supabase = createClient();
  const { t } = useLanguage();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Get Turnstile token
      const token = turnstileRef.current?.getResponse();
      if (!token) {
        setError(t('login.completeVerify'));
        setLoading(false);
        return;
      }

      // Verify Turnstile token
      const verifyRes = await fetch('/api/auth/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!verifyRes.ok) {
        setError(t('login.verifyError'));
        turnstileRef.current?.reset();
        setLoading(false);
        return;
      }

      // Send Magic Link
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError(t('login.unexpectedError'));
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-2xl font-bold mb-2">{t('login.checkEmail')}</h2>
          <p className="text-gray-600">
            {t('login.linkSent')} <strong>{email}</strong>
          </p>
          <p className="text-gray-500 text-sm mt-4">
            {t('login.clickLink')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">{t('login.title')}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('login.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
          >
            {loading ? t('login.sending') : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
