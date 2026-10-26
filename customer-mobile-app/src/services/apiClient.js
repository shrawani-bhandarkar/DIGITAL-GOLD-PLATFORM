import { apiConfig, requireBackendMode } from '../config/apiConfig';

let accessToken = null;
let unauthorizedHandler = null;

export class ApiError extends Error {
  constructor(message, status = null, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function setAccessToken(token) {
  accessToken = typeof token === 'string' && token.length > 0 ? token : null;
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

export async function apiRequest(route, { body, query, idempotencyKey, cache } = {}) {
  requireBackendMode();
  const queryString = query
    ? `?${Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&')}`
    : '';
  const url = `${apiConfig.baseUrl}${route.path}${queryString}`;
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), apiConfig.timeoutMs);
  let response;
  try {
    response = await fetch(url, {
      method: route.method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      ...(cache ? { cache } : {}),
    });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new ApiError('The request timed out. Please try again.', null, 'TIMEOUT');
    }
    throw new ApiError('Unable to reach the service. Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
  }

  let payload = null;
  if (response.status !== 204) {
    try {
      payload = await response.json();
    } catch {
      throw new ApiError('The service returned an invalid response.', response.status, 'INVALID_RESPONSE');
    }
  }
  if (response.status === 401) {
    const hadSession = Boolean(accessToken);
    setAccessToken(null);
    if (hadSession && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(
      hadSession
        ? 'Your session has expired. Please sign in again.'
        : typeof payload?.message === 'string'
          ? payload.message
          : 'The service rejected the authentication request.',
      401,
      'UNAUTHORIZED',
    );
  }
  if (!response.ok) {
    throw new ApiError(
      typeof payload?.message === 'string'
        ? payload.message
        : response.status >= 500
        ? 'The service is temporarily unavailable. Please try again later.'
        : 'The request could not be completed. Check the details and try again.',
      response.status,
    );
  }
  return payload;
}
