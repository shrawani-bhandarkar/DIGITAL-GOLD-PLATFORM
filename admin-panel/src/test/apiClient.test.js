// Runtime validation coverage for the prepared API transport boundary.
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('apiRequest preparation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('uses same-origin API paths when no base URL is configured', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest } = await import('../services/apiClient.js');
    await expect(apiRequest('/api/auth/session')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('uses a same-origin API path prefix without duplicating existing API routes', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest } = await import('../services/apiClient.js');
    await expect(apiRequest('/api/auth/session')).resolves.toEqual({ ok: true });
    await expect(apiRequest('/health')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/auth/session', '/api/health']);
  });

  it('sends JSON and parses successful responses without embedding an endpoint in the UI', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/v1/');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"demo-1"}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest } = await import('../services/apiClient.js');
    await expect(apiRequest('/records', { method: 'POST', body: { name: 'Demo' } })).resolves.toEqual({ id: 'demo-1' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/v1/records', expect.objectContaining({
      method: 'POST',
      body: '{"name":"Demo"}',
    }));
    expect(fetchMock.mock.calls[0][1].headers.get('content-type')).toBe('application/json');
    expect(fetchMock.mock.calls[0][1].headers.get('accept')).toBe('application/json');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('rejects unsafe paths and reports HTTP failures explicitly', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503, statusText: 'Unavailable' }));
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest } = await import('../services/apiClient.js');
    await expect(apiRequest('//other.example')).rejects.toThrow('same-origin paths');
    await expect(apiRequest('/health')).rejects.toThrow('API request failed (503): Unavailable');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('surfaces API-provided authentication errors', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"message":"Invalid email/username or password."}', {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest } = await import('../services/apiClient.js');
    await expect(apiRequest('/api/auth/login', { method: 'POST', body: { email: 'bad@example.com', password: 'bad' } }))
      .rejects.toThrow('Invalid email/username or password.');
  });
});
