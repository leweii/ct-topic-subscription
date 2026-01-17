'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import en from './locales/en.json';
import zh from './locales/zh.json';

type Language = 'en' | 'zh';
type Translations = typeof en;

const translations: Record<Language, Translations> = { en, zh };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
  return typeof value === 'string' ? value : path;
}

function detectLanguage(): Language {
  if (typeof window === 'undefined') return 'en';

  const saved = localStorage.getItem('language') as Language;
  if (saved && (saved === 'en' || saved === 'zh')) return saved;

  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('zh')) return 'zh';
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLanguageState(detectLanguage());
    setMounted(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string): string => {
    return getNestedValue(translations[language] as unknown as Record<string, unknown>, key);
  };

  // Always provide context, even during SSR - just hide content until mounted
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {mounted ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
