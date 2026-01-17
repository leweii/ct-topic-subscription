'use client';

import { useLanguage } from '@/lib/i18n/context';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex gap-1 text-sm">
      <button
        onClick={() => setLanguage('en')}
        className={`px-1 ${language === 'en' ? 'font-bold text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
      >
        EN
      </button>
      <span className="text-gray-300">|</span>
      <button
        onClick={() => setLanguage('zh')}
        className={`px-1 ${language === 'zh' ? 'font-bold text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
      >
        中文
      </button>
    </div>
  );
}
