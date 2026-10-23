import { apiRoutes } from '../config/apiRoutes';
import { apiRequest, setAccessToken } from './apiClient';

export async function requestOtp(mobileNumber) {
  return apiRequest(apiRoutes.requestOtp, { body: { mobileNumber } });
}

export async function verifyOtp(mobileNumber, otp) {
  const result = await apiRequest(apiRoutes.verifyOtp, { body: { mobileNumber, otp } });
  if (result?.verified !== true || typeof result.accessToken !== 'string' || !result.accessToken) {
    throw new Error('The authentication response did not include a valid session token.');
  }
  setAccessToken(result.accessToken);
  return { verified: true, profile: result.profile };
}

export async function logout() {
  try {
    await apiRequest(apiRoutes.logout);
  } finally {
    setAccessToken(null);
  }
}
