import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { SourceLinksInput } from '@/components/SourceLinksInput';
import { LanguageProvider } from '@/lib/i18n/context';
import type { SubscriptionLink } from '@/lib/types';

// Helper to render component with LanguageProvider
const renderWithProvider = (ui: React.ReactElement) => {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
};

const mockLinks: SubscriptionLink[] = [
  {
    id: 'link-1',
    subscription_id: 'sub-1',
    url: 'https://youtube.com/channel/1',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'link-2',
    subscription_id: 'sub-1',
    url: 'https://blog.example.com',
    created_at: '2024-01-02T00:00:00Z',
  },
];

describe('SourceLinksInput', () => {
  const mockOnLinksChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (localStorage.getItem as jest.Mock).mockReturnValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'new-link',
        subscription_id: 'sub-1',
        url: 'https://new-link.com',
        created_at: new Date().toISOString(),
      }),
    });
  });

  describe('rendering', () => {
    it('renders source label', async () => {
      renderWithProvider(
        <SourceLinksInput links={[]} onLinksChange={mockOnLinksChange} />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(screen.getByText('Sources (optional)')).toBeInTheDocument();
    });

    it('renders input and add button', async () => {
      renderWithProvider(
        <SourceLinksInput links={[]} onLinksChange={mockOnLinksChange} />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(screen.getByPlaceholderText('Enter YouTube or blog URL')).toBeInTheDocument();
      expect(screen.getByText('Add')).toBeInTheDocument();
    });

    it('renders existing links', async () => {
      renderWithProvider(
        <SourceLinksInput links={mockLinks} onLinksChange={mockOnLinksChange} />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(screen.getByText('https://youtube.com/channel/1')).toBeInTheDocument();
      expect(screen.getByText('https://blog.example.com')).toBeInTheDocument();
    });

    it('shows link count', async () => {
      renderWithProvider(
        <SourceLinksInput links={mockLinks} onLinksChange={mockOnLinksChange} maxLinks={5} />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(screen.getByText('2/5 sources')).toBeInTheDocument();
    });
  });

  describe('adding links', () => {
    it('adds link for new subscription (no subscriptionId)', async () => {
      renderWithProvider(
        <SourceLinksInput links={[]} onLinksChange={mockOnLinksChange} />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const input = screen.getByPlaceholderText('Enter YouTube or blog URL');
      const addButton = screen.getByText('Add');

      fireEvent.change(input, { target: { value: 'https://youtube.com/test' } });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockOnLinksChange).toHaveBeenCalledWith([
          expect.objectContaining({
            url: 'https://youtube.com/test',
            id: expect.stringContaining('temp-'),
          }),
        ]);
      });
    });

    it('adds link via API when subscriptionId provided', async () => {
      renderWithProvider(
        <SourceLinksInput
          subscriptionId="sub-123"
          links={[]}
          onLinksChange={mockOnLinksChange}
        />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const input = screen.getByPlaceholderText('Enter YouTube or blog URL');
      const addButton = screen.getByText('Add');

      fireEvent.change(input, { target: { value: 'https://youtube.com/test' } });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/subscriptions/sub-123/links',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ url: 'https://youtube.com/test' }),
          })
        );
      });
    });

    it('adds link on Enter key press', async () => {
      renderWithProvider(
        <SourceLinksInput links={[]} onLinksChange={mockOnLinksChange} />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const input = screen.getByPlaceholderText('Enter YouTube or blog URL');

      fireEvent.change(input, { target: { value: 'https://youtube.com/test' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockOnLinksChange).toHaveBeenCalled();
      });
    });

    it('validates URL format', async () => {
      renderWithProvider(
        <SourceLinksInput links={[]} onLinksChange={mockOnLinksChange} />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const input = screen.getByPlaceholderText('Enter YouTube or blog URL');
      const addButton = screen.getByText('Add');

      fireEvent.change(input, { target: { value: 'not-a-valid-url' } });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid URL')).toBeInTheDocument();
      });

      expect(mockOnLinksChange).not.toHaveBeenCalled();
    });

    it('clears input after successful add', async () => {
      renderWithProvider(
        <SourceLinksInput links={[]} onLinksChange={mockOnLinksChange} />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const input = screen.getByPlaceholderText('Enter YouTube or blog URL') as HTMLInputElement;
      const addButton = screen.getByText('Add');

      fireEvent.change(input, { target: { value: 'https://youtube.com/test' } });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });
  });

  describe('removing links', () => {
    it('removes link from local state for temp links', async () => {
      const tempLinks: SubscriptionLink[] = [
        {
          id: 'temp-12345',
          subscription_id: '',
          url: 'https://youtube.com/test',
          created_at: new Date().toISOString(),
        },
      ];

      renderWithProvider(
        <SourceLinksInput links={tempLinks} onLinksChange={mockOnLinksChange} />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const removeButtons = document.querySelectorAll('button');
      const removeButton = Array.from(removeButtons).find(
        btn => btn.querySelector('svg path[d*="6 18L18 6"]')
      );

      if (removeButton) {
        fireEvent.click(removeButton);
      }

      expect(mockOnLinksChange).toHaveBeenCalledWith([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('calls API to delete saved links', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      renderWithProvider(
        <SourceLinksInput
          subscriptionId="sub-123"
          links={mockLinks}
          onLinksChange={mockOnLinksChange}
        />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const removeButtons = document.querySelectorAll('button');
      const removeButton = Array.from(removeButtons).find(
        btn => btn.querySelector('svg path[d*="6 18L18 6"]')
      );

      if (removeButton) {
        fireEvent.click(removeButton);
      }

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/subscriptions/sub-123/links/link-1',
          expect.objectContaining({ method: 'DELETE' })
        );
      });
    });
  });

  describe('link limits', () => {
    it('shows limit message when max links reached', async () => {
      const maxLinks = 2;
      renderWithProvider(
        <SourceLinksInput
          links={mockLinks}
          onLinksChange={mockOnLinksChange}
          maxLinks={maxLinks}
        />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(screen.getByText('Source limit reached')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Enter YouTube or blog URL')).not.toBeInTheDocument();
    });

    it('allows adding when under limit', async () => {
      renderWithProvider(
        <SourceLinksInput
          links={[mockLinks[0]]}
          onLinksChange={mockOnLinksChange}
          maxLinks={5}
        />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(screen.getByPlaceholderText('Enter YouTube or blog URL')).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('disables input when disabled prop is true', async () => {
      renderWithProvider(
        <SourceLinksInput
          links={[]}
          onLinksChange={mockOnLinksChange}
          disabled={true}
        />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const input = screen.getByPlaceholderText('Enter YouTube or blog URL');
      expect(input).toBeDisabled();
    });

    it('disables remove buttons when disabled', async () => {
      renderWithProvider(
        <SourceLinksInput
          links={mockLinks}
          onLinksChange={mockOnLinksChange}
          disabled={true}
        />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const removeButtons = document.querySelectorAll('button[type="button"]');
      removeButtons.forEach(button => {
        if (button.querySelector('svg')) {
          expect(button).toBeDisabled();
        }
      });
    });
  });

  describe('error handling', () => {
    it('shows error from API response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Link already exists' }),
      });

      renderWithProvider(
        <SourceLinksInput
          subscriptionId="sub-123"
          links={[]}
          onLinksChange={mockOnLinksChange}
        />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const input = screen.getByPlaceholderText('Enter YouTube or blog URL');
      const addButton = screen.getByText('Add');

      fireEvent.change(input, { target: { value: 'https://youtube.com/test' } });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Link already exists')).toBeInTheDocument();
      });
    });
  });
});
