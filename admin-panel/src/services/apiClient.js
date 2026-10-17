const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

export async function apiRequest(path, options = {}) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /[\u0000-\u001f]/.test(path)) {
    throw new Error('API paths must be same-origin paths beginning with one slash.');
  }

  const { body, headers: suppliedHeaders, ...requestOptions } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  const isSearchParams = typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams;
  const isBinaryBody = isFormData || isBlob || isSearchParams || body instanceof ArrayBuffer || ArrayBuffer.isView(body);
  const hasBody = body !== undefined && body !== null;
  const requestBody = hasBody && typeof body === 'object' && !isBinaryBody ? JSON.stringify(body) : body;
  const headers = new Headers(suppliedHeaders);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (hasBody && !isBinaryBody && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    credentials: requestOptions.credentials ?? 'include',
    body: requestBody,
    headers,
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json') || contentType.includes('+json')) {
      let payload;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (typeof payload?.message === 'string' && payload.message.trim()) {
        throw new Error(payload.message);
      }
    }
    throw new Error(`API request failed (${response.status})${response.statusText ? `: ${response.statusText}` : ''}`);
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    const responseText = await response.text();
    if (!responseText.trim()) return null;
    throw new Error('API returned a non-JSON response. Expected application/json.');
  }
  try {
    return await response.json();
  } catch (error) {
    throw new Error('API returned malformed JSON.', { cause: error });
  }
}
