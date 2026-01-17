'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/context';

export function DynamicTitle() {
  const { t } = useLanguage();

  useEffect(() => {
    document.title = t('metadata.title');
  }, [t]);

  return null;
}
