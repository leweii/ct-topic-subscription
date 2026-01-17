/**
 * @jest-environment node
 */

// Mock the Supabase server client
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockFrom = jest.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
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
import { GET, POST } from '@/app/api/subscriptions/route';

describe('GET /api/subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns subscriptions for authenticated user', async () => {
    const mockUser = { id: 'user-123' };
    const mockSubscriptions = [
      { id: 'sub-1', topic_intent: 'AI news', subscription_links: [] },
      { id: 'sub-2', topic_intent: 'Tech updates', subscription_links: [] },
    ];

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockSelect.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: mockSubscriptions, error: null }),
      }),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockSubscriptions);
    expect(mockFrom).toHaveBeenCalledWith('subscriptions');
  });

  it('returns 500 when database error occurs', async () => {
    const mockUser = { id: 'user-123' };

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockSelect.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      }),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('DB error');
  });
});

describe('POST /api/subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const request = new Request('http://localhost/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ topic_intent: 'Test topic' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('creates subscription with default values', async () => {
    const mockUser = { id: 'user-123' };
    const mockCreatedSub = {
      id: 'sub-new',
      user_id: 'user-123',
      topic_intent: 'Test topic',
      time_window: '7d',
      output_mode: 'brief',
      frequency: 'once',
    };

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockInsert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockCreatedSub, error: null }),
      }),
    });

    const request = new Request('http://localhost/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ topic_intent: 'Test topic' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual(mockCreatedSub);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        topic_intent: 'Test topic',
        time_window: '7d',
        output_mode: 'brief',
        frequency: 'once',
      })
    );
  });

  it('creates subscription with custom values', async () => {
    const mockUser = { id: 'user-123' };
    const mockCreatedSub = {
      id: 'sub-new',
      user_id: 'user-123',
      topic_intent: 'AI updates',
      time_window: '30d',
      output_mode: 'report',
      frequency: 'weekly',
    };

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockInsert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockCreatedSub, error: null }),
      }),
    });

    const request = new Request('http://localhost/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        topic_intent: 'AI updates',
        time_window: '30d',
        output_mode: 'report',
        frequency: 'weekly',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.time_window).toBe('30d');
    expect(data.output_mode).toBe('report');
    expect(data.frequency).toBe('weekly');
  });

  it('returns 500 on database error', async () => {
    const mockUser = { id: 'user-123' };

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockInsert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
      }),
    });

    const request = new Request('http://localhost/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ topic_intent: 'Test' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Insert failed');
  });
});
