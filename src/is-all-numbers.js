/**
 * Check if a string contains only numeric digits
 * @param {string} str - The string to check
 * @returns {boolean} True if the string contains only digits 0-9
 */
export const isAllNumbers = (str) => /^\d+$/.test(str);
