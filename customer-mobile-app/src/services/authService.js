import { apiRoutes } from '../config/apiRoutes';
import { apiConfig } from '../config/apiConfig';
import { apiRequest, setAccessToken } from './apiClient';
import { requestDemoOtp, verifyDemoOtp } from './demoAuth';

export async function requestOtp(mobileNumber) {
  if (apiConfig.mode === 'demo') return requestDemoOtp(mobileNumber);
  return apiRequest(apiRoutes.requestOtp, { body: { mobileNumber } });
}

export async function verifyOtp(mobileNumber, otp) {
  if (apiConfig.mode === 'demo') return verifyDemoOtp(mobileNumber, otp);
  const result = await apiRequest(apiRoutes.verifyOtp, { body: { mobileNumber, otp } });
  if (!result || typeof result.accessToken !== 'string' || !result.accessToken) {
    throw new Error('The authentication response did not include a valid session token.');
  }
  setAccessToken(result.accessToken);
  return { verified: true, profile: result.profile };
}

export async function logout() {
  if (apiConfig.mode === 'backend') {
    try {
      await apiRequest(apiRoutes.logout);
    } finally {
      setAccessToken(null);
    }
    return;
  }
  setAccessToken(null);
}
