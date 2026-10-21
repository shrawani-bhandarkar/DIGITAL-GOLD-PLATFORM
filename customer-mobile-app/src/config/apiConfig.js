const requestedMode = (process.env.EXPO_PUBLIC_DATA_MODE || 'demo').toLowerCase();

if (requestedMode !== 'demo' && requestedMode !== 'backend') {
  throw new Error('EXPO_PUBLIC_DATA_MODE must be either "demo" or "backend".');
}

export const apiConfig = {
  mode: requestedMode,
  baseUrl: (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/+$/, ''),
  timeoutMs: 12000,
};

export function requireBackendMode() {
  if (apiConfig.mode !== 'backend') {
    throw new Error('This operation requires backend mode; no request was sent.');
  }
  if (!apiConfig.baseUrl) {
    throw new Error('Backend mode is enabled but EXPO_PUBLIC_API_BASE_URL is not configured.');
  }
}
