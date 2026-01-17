import React from 'react';
import { render, screen, act, renderHook } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '@/lib/i18n/context';

// Helper to wrap component with LanguageProvider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LanguageProvider>{children}</LanguageProvider>
);

describe('LanguageProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (localStorage.getItem as jest.Mock).mockReturnValue(null);
    Object.defineProperty(navigator, 'language', { value: 'en-US', writable: true });
  });

  describe('initial language detection', () => {
    it('defaults to English when no saved preference', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.language).toBe('en');
    });

    it('uses saved language from localStorage', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('zh');

      const { result } = renderHook(() => useLanguage(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.language).toBe('zh');
    });

    it('detects Chinese from browser language', async () => {
      Object.defineProperty(navigator, 'language', { value: 'zh-CN', writable: true });

      const { result } = renderHook(() => useLanguage(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.language).toBe('zh');
    });

    it('falls back to English for unsupported languages', async () => {
      Object.defineProperty(navigator, 'language', { value: 'fr-FR', writable: true });

      const { result } = renderHook(() => useLanguage(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.language).toBe('en');
    });
  });

  describe('setLanguage', () => {
    it('changes language and saves to localStorage', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.setLanguage('zh');
      });

      expect(result.current.language).toBe('zh');
      expect(localStorage.setItem).toHaveBeenCalledWith('language', 'zh');
    });

    it('switches back to English', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('zh');

      const { result } = renderHook(() => useLanguage(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.setLanguage('en');
      });

      expect(result.current.language).toBe('en');
      expect(localStorage.setItem).toHaveBeenCalledWith('language', 'en');
    });
  });

  describe('translation function (t)', () => {
    it('returns English translation', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.t('login.title')).toBe('Sign In');
    });

    it('returns Chinese translation when language is zh', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('zh');

      const { result } = renderHook(() => useLanguage(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.t('login.title')).toBe('登录');
    });

    it('returns nested translations', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.t('subscription.timeOptions.7d')).toBe('Past 7 days');
    });

    it('returns key when translation not found', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.t('nonexistent.key')).toBe('nonexistent.key');
    });
  });

  describe('SSR behavior', () => {
    it('always provides context even before mounting', () => {
      // This test ensures the fix for prerender errors works
      const TestComponent = () => {
        const { language, t } = useLanguage();
        return <div data-testid="test">{language}-{t('login.title')}</div>;
      };

      render(
        <LanguageProvider>
          <TestComponent />
        </LanguageProvider>
      );

      // Should not throw "useLanguage must be used within LanguageProvider"
      expect(screen.getByTestId('test')).toBeInTheDocument();
    });
  });
});

describe('useLanguage hook', () => {
  it('throws error when used outside LanguageProvider', () => {
    // Suppress console.error for this test
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useLanguage());
    }).toThrow('useLanguage must be used within LanguageProvider');

    spy.mockRestore();
  });
});
