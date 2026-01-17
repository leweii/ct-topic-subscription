/**
 * @jest-environment node
 */

// Mock the Supabase server client
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockDelete = jest.fn();
const mockFrom = jest.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  delete: mockDelete,
}));
const mockGetUser = jest.fn();
const mockSupabase = {
  auth: {
    getUser: mockGetUser,
  },
  from: mockFrom,
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// Import after mocking
import { POST } from '@/app/api/subscriptions/[id]/links/route';
import { DELETE } from '@/app/api/subscriptions/[id]/links/[linkId]/route';

describe('POST /api/subscriptions/[id]/links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const request = new Request('http://localhost/api/subscriptions/sub-1/links', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://youtube.com/test' }),
    });

    const response = await POST(request, { params: { id: 'sub-1' } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 when subscription not found', async () => {
    const mockUser = { id: 'user-123' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    // First call: check subscription ownership
    mockSelect.mockReturnValueOnce({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/subscriptions/sub-1/links', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://youtube.com/test' }),
    });

    const response = await POST(request, { params: { id: 'sub-1' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Subscription not found');
  });

  it('returns 400 for invalid URL', async () => {
    const mockUser = { id: 'user-123' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    // Mock subscription found
    mockSelect.mockReturnValueOnce({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'sub-1' } }),
        }),
      }),
    });

    // Mock link count check
    mockSelect.mockReturnValueOnce({
      eq: jest.fn().mockResolvedValue({ count: 0 }),
    });

    const request = new Request('http://localhost/api/subscriptions/sub-1/links', {
      method: 'POST',
      body: JSON.stringify({ url: 'not-a-valid-url' }),
    });

    const response = await POST(request, { params: { id: 'sub-1' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid URL');
  });

  it('returns 400 when link limit reached', async () => {
    const mockUser = { id: 'user-123' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    // Mock subscription found
    mockSelect.mockReturnValueOnce({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'sub-1' } }),
        }),
      }),
    });

    // Mock link count check - at limit (5)
    mockSelect.mockReturnValueOnce({
      eq: jest.fn().mockResolvedValue({ count: 5 }),
    });

    const request = new Request('http://localhost/api/subscriptions/sub-1/links', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://youtube.com/test' }),
    });

    const response = await POST(request, { params: { id: 'sub-1' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Link limit reached');
    expect(data.limit).toBe(5);
  });

  it('creates link successfully', async () => {
    const mockUser = { id: 'user-123' };
    const mockCreatedLink = {
      id: 'link-new',
      subscription_id: 'sub-1',
      url: 'https://youtube.com/test',
      created_at: new Date().toISOString(),
    };

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    // Mock subscription found
    mockSelect.mockReturnValueOnce({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'sub-1' } }),
        }),
      }),
    });

    // Mock link count check
    mockSelect.mockReturnValueOnce({
      eq: jest.fn().mockResolvedValue({ count: 2 }),
    });

    // Mock insert
    mockInsert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockCreatedLink, error: null }),
      }),
    });

    const request = new Request('http://localhost/api/subscriptions/sub-1/links', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://youtube.com/test' }),
    });

    const response = await POST(request, { params: { id: 'sub-1' } });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual(mockCreatedLink);
  });

  it('returns 400 for duplicate URL', async () => {
    const mockUser = { id: 'user-123' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    // Mock subscription found
    mockSelect.mockReturnValueOnce({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'sub-1' } }),
        }),
      }),
    });

    // Mock link count check
    mockSelect.mockReturnValueOnce({
      eq: jest.fn().mockResolvedValue({ count: 2 }),
    });

    // Mock insert with unique constraint error
    mockInsert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: { code: '23505' } }),
      }),
    });

    const request = new Request('http://localhost/api/subscriptions/sub-1/links', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://youtube.com/test' }),
    });

    const response = await POST(request, { params: { id: 'sub-1' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('URL already exists');
  });
});

describe('DELETE /api/subscriptions/[id]/links/[linkId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const request = new Request('http://localhost/api/subscriptions/sub-1/links/link-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, {
      params: { id: 'sub-1', linkId: 'link-1' },
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 when subscription not found', async () => {
    const mockUser = { id: 'user-123' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    mockSelect.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/subscriptions/sub-1/links/link-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, {
      params: { id: 'sub-1', linkId: 'link-1' },
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Subscription not found');
  });

  it('deletes link successfully', async () => {
    const mockUser = { id: 'user-123' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    // Mock subscription found
    mockSelect.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'sub-1' } }),
        }),
      }),
    });

    // Mock delete
    mockDelete.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    const request = new Request('http://localhost/api/subscriptions/sub-1/links/link-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, {
      params: { id: 'sub-1', linkId: 'link-1' },
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
