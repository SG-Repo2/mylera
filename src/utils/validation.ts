/**
 * Checks if the input string is a valid email format.
 */
export function isValidEmail(email: string): boolean {
    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /**
   * Checks basic password strength criteria (length, possible additions like uppercase/numbers, etc.).
   */
  export function isValidPassword(password: string): boolean {
    // Basic example: password should be at least 6 characters
    return password.length >= 6;
  }
  
  /**
   * Checks if two passwords match.
   */
  export function doPasswordsMatch(password: string, confirmPassword: string): boolean {
    return password === confirmPassword;
  }