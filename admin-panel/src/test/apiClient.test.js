// Runtime validation coverage for the prepared API transport boundary.
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('apiRequest preparation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('rejects requests until the API base URL is configured', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const { apiRequest } = await import('../services/apiClient.js');
    await expect(apiRequest('/customers')).rejects.toThrow('API base URL is not configured');
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
});
