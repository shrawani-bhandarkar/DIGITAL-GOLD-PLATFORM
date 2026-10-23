import { Platform } from 'react-native';

const requestedMode = (process.env.EXPO_PUBLIC_DATA_MODE || 'backend').toLowerCase();

if (requestedMode !== 'demo' && requestedMode !== 'backend') {
  throw new Error('EXPO_PUBLIC_DATA_MODE must be either "demo" or "backend".');
}

const developmentApiBaseUrl = Platform.OS === 'android'
  ? 'http://10.0.2.2:4000'
  : 'http://localhost:4000';

export const apiConfig = {
  mode: requestedMode,
  baseUrl: (process.env.EXPO_PUBLIC_API_BASE_URL || (__DEV__ ? developmentApiBaseUrl : '')).replace(/\/+$/, ''),
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
