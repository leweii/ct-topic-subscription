'use client';

import { useLanguage } from '@/lib/i18n/context';

function GlobeIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  );
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1 border border-gray-200">
      <GlobeIcon />
      <button
        onClick={() => setLanguage('en')}
        className={`px-2 py-0.5 rounded-full text-sm transition-colors ${
          language === 'en'
            ? 'bg-blue-600 text-white font-medium'
            : 'text-gray-600 hover:bg-gray-200'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('zh')}
        className={`px-2 py-0.5 rounded-full text-sm transition-colors ${
          language === 'zh'
            ? 'bg-blue-600 text-white font-medium'
            : 'text-gray-600 hover:bg-gray-200'
        }`}
      >
        中文
      </button>
    </div>
  );
}
