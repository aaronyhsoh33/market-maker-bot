/**
 * Price calculation utilities for market making operations
 */

/**
 * Rounds a price to the nearest tick size multiple
 * @param price The price to round
 * @param tickSize The minimum price increment
 * @returns The rounded price
 */
export function roundToTickSize(price: number, tickSize: number): number {
  return Math.round(price / tickSize) * tickSize;
}

/**
 * Converts basis points to decimal percentage
 * @param basisPoints Basis points (1 basis point = 0.01%)
 * @returns Decimal percentage (e.g., 100 bp = 0.01)
 */
export function basisPointsToDecimal(basisPoints: number): number {
  return basisPoints / 10000;
}

/**
 * Calculates bid price based on mid price and spread
 * @param midPrice The mid/current price
 * @param spreadBasisPoints Spread width in basis points
 * @returns Bid price (mid - spread/2)
 */
export function calculateBidPrice(midPrice: number, spreadBasisPoints: number): number {
  const spreadDecimal = basisPointsToDecimal(spreadBasisPoints);
  return midPrice - (midPrice * spreadDecimal);
}

/**
 * Calculates ask price based on mid price and spread
 * @param midPrice The mid/current price
 * @param spreadBasisPoints Spread width in basis points
 * @returns Ask price (mid + spread/2)
 */
export function calculateAskPrice(midPrice: number, spreadBasisPoints: number): number {
  const spreadDecimal = basisPointsToDecimal(spreadBasisPoints);
  return midPrice + (midPrice * spreadDecimal);
}

/**
 * Calculates the maximum deviation amount based on percentage
 * @param price The reference price
 * @param deviationPercent Maximum deviation as a percentage (e.g., 5 = 5%)
 * @returns Maximum deviation amount
 */
export function calculateMaxDeviationAmount(price: number, deviationPercent: number): number {
  return price * (deviationPercent / 100);
}

/**
 * Calculates the absolute deviation between two prices
 * @param price1 First price
 * @param price2 Second price
 * @returns Absolute deviation amount
 */
export function calculatePriceDeviation(price1: number, price2: number): number {
  return Math.abs(price1 - price2);
}

/**
 * Calculates bid and ask prices with tick size rounding
 * @param midPrice The mid/current price
 * @param spreadBasisPoints Spread width in basis points
 * @param tickSize The minimum price increment
 * @returns Object with rounded bid and ask prices
 */
export function calculateRoundedBidAsk(
  midPrice: number,
  spreadBasisPoints: number,
  tickSize: number
): { bidPrice: number; askPrice: number } {
  const bidPrice = calculateBidPrice(midPrice, spreadBasisPoints);
  const askPrice = calculateAskPrice(midPrice, spreadBasisPoints);

  return {
    bidPrice: roundToTickSize(bidPrice, tickSize),
    askPrice: roundToTickSize(askPrice, tickSize)
  };
}

/**
 * Calculates spread amount in price units
 * @param midPrice The mid/current price
 * @param spreadBasisPoints Spread width in basis points
 * @returns Spread amount (half-spread from mid to bid/ask)
 */
export function calculateSpreadAmount(midPrice: number, spreadBasisPoints: number): number {
  const spreadDecimal = basisPointsToDecimal(spreadBasisPoints);
  return midPrice * spreadDecimal;
}