/**
 * Checks if the input string is a valid email format.
 */
export function isValidEmail(email: string): boolean {
    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /**
   * Checks password strength criteria:
   * - At least 8 characters long
   * - Contains at least one uppercase letter
   * - Contains at least one lowercase letter
   * - Contains at least one number
   */
  export function isValidPassword(password: string): boolean {
    return password.length >= 8 && 
           /[A-Z]/.test(password) && 
           /[a-z]/.test(password) && 
           /[0-9]/.test(password);
  }
  
  /**
   * Checks if two passwords match.
   */
  export function doPasswordsMatch(password: string, confirmPassword: string): boolean {
    return password === confirmPassword;
  }
