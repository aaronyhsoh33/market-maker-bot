/**
 * Order utility functions for market making operations
 */

/**
 * Generates a unique client order ID with timestamp
 * @param prefix Optional prefix for the order ID (default: 'mmbot')
 * @returns Unique client order ID in format: prefix-timestamp
 * @example
 * generateClientOrderId('bot') // returns "bot-1640995200000"
 */
export function generateClientOrderId(prefix: string = 'mmbot'): string {
  const timestamp = Date.now();
  return `${prefix}-${timestamp}`;
}

/**
 * Generates expiration timestamp for GTD (Good Till Date) orders
 * @param minutesFromNow Number of minutes from now when the order should expire
 * @returns Unix timestamp in seconds for order expiration
 * @example
 * generateExpiresAt(5) // returns timestamp 5 minutes from now
 */
export function generateExpiresAt(minutesFromNow: number): number {
  return Math.floor(Date.now() / 1000) + minutesFromNow * 60;
}

/**
 * Converts order side string to numeric representation for API calls
 * @param side Order side as string ('BUY' or 'SELL')
 * @returns Numeric representation (0 for BUY, 1 for SELL)
 * @example
 * convertSideToNumber('BUY') // returns 0
 * convertSideToNumber('SELL') // returns 1
 */
export function convertSideToNumber(side: 'BUY' | 'SELL'): 0 | 1 {
  return side === 'BUY' ? 0 : 1;
}