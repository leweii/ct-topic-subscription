'use client';

import { LanguageProvider } from '@/lib/i18n/context';
import { DynamicTitle } from './DynamicTitle';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <DynamicTitle />
      {children}
    </LanguageProvider>
  );
}
