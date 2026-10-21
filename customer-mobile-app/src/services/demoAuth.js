const DEMO_OTP = '123456';

const simulateDemoRequest = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 350);
  });

export { DEMO_OTP };

export async function requestDemoOtp(mobileNumber) {
  if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
    throw new Error('A valid 10-digit Indian mobile number is required.');
  }
  await simulateDemoRequest();

  return {
    demoOnly: true,
  };
}

export async function verifyDemoOtp(mobileNumber, otp) {
  await simulateDemoRequest();

  return {
    verified: /^[6-9]\d{9}$/.test(mobileNumber) && otp === DEMO_OTP,
    demoOnly: true,
  };
}

export async function logoutDemo() {
  await simulateDemoRequest();
  return { demoOnly: true };
}

// Backend route proposals are centralized in src/config/apiRoutes.js.
// Never expose production OTPs in the UI.
