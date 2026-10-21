export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must be at least 8 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character.";

export function isValidPassword(password: string): boolean {
  return password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
}