import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LanguageProvider } from '@/lib/i18n/context';

// Helper to render component with LanguageProvider
const renderWithProvider = (ui: React.ReactElement) => {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
};

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (localStorage.getItem as jest.Mock).mockReturnValue(null);
  });

  it('renders EN and 中文 buttons', async () => {
    renderWithProvider(<LanguageSwitcher />);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('中文')).toBeInTheDocument();
  });

  it('renders globe icon', async () => {
    renderWithProvider(<LanguageSwitcher />);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('highlights EN button when language is English', async () => {
    renderWithProvider(<LanguageSwitcher />);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const enButton = screen.getByText('EN');
    expect(enButton.className).toContain('bg-blue-600');
    expect(enButton.className).toContain('text-white');
  });

  it('highlights 中文 button when language is Chinese', async () => {
    (localStorage.getItem as jest.Mock).mockReturnValue('zh');

    renderWithProvider(<LanguageSwitcher />);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const zhButton = screen.getByText('中文');
    expect(zhButton.className).toContain('bg-blue-600');
    expect(zhButton.className).toContain('text-white');
  });

  it('switches to Chinese when 中文 button is clicked', async () => {
    renderWithProvider(<LanguageSwitcher />);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const zhButton = screen.getByText('中文');
    fireEvent.click(zhButton);

    expect(localStorage.setItem).toHaveBeenCalledWith('language', 'zh');
  });

  it('switches to English when EN button is clicked', async () => {
    (localStorage.getItem as jest.Mock).mockReturnValue('zh');

    renderWithProvider(<LanguageSwitcher />);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const enButton = screen.getByText('EN');
    fireEvent.click(enButton);

    expect(localStorage.setItem).toHaveBeenCalledWith('language', 'en');
  });

  it('has visible border styling', async () => {
    renderWithProvider(<LanguageSwitcher />);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const container = screen.getByText('EN').closest('div');
    expect(container?.className).toContain('border-2');
    expect(container?.className).toContain('border-blue-500');
  });
});
