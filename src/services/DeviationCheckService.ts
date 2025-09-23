import { TradingPair, MarketState } from '../types/marketMaker';
import { loadConfig, AssetConfig } from '../config/marketConfig';
import { calculateMaxDeviationAmount, calculateSpreadAmount, calculatePriceDeviation } from '../utils/priceUtils';

/**
 * Risk management service for market making operations
 *
 * This service implements price deviation checking to protect against adverse
 * market movements. It monitors active orders and positions, recommending
 * cancellations when prices move too far from expected ranges.
 *
 * Key risk management concepts:
 * - Orders placed too far from current market price should be cancelled
 * - Positions with excessive unrealized losses may need to be closed
 * - Maximum deviation thresholds prevent runaway losses in volatile markets
 */
export class DeviationCheckService {
  private config = loadConfig();

  /**
   * Calculates market state including optimal bid/ask prices and deviation limits
   *
   * Creates a comprehensive market state snapshot that includes:
   * - Current mid price (reference point)
   * - Optimal bid/ask prices based on configured spread
   * - Maximum deviation threshold for risk management
   *
   * @param ticker Trading pair symbol (e.g., 'BTCUSD')
   * @param currentPrice Current market price to use as mid price
   * @param maxDeviation Maximum allowed price deviation percentage (e.g., 5.0 = 5%)
   * @returns MarketState object with calculated prices and thresholds
   */
  calculateMarketState(ticker: string, currentPrice: number, maxDeviation: number): MarketState {
    const maxDeviationPrice = calculateMaxDeviationAmount(currentPrice, maxDeviation);

    // Get spread width from config
    const assetConfig = this.config.assets.find(asset => asset.ticker === ticker);
    const spreadWidthBp = assetConfig?.spreadWidth || 10; // Default to 10bp if not found
    const spreadAmount = calculateSpreadAmount(currentPrice, spreadWidthBp);

    return {
      ticker,
      midPrice: currentPrice,
      bidPrice: currentPrice - spreadAmount / 2,
      askPrice: currentPrice + spreadAmount / 2,
      maxDeviationPrice,
      timestamp: Date.now()
    };
  }

  /**
   * Analyzes trading pair state and recommends risk management actions
   *
   * Evaluates active orders and positions against current market conditions
   * to determine if any risk management actions are needed:
   *
   * Order Cancellation Logic:
   * - Cancel bid orders that are too far above current market price
   * - Cancel ask orders that are too far below current market price
   * - Only considers 'NEW' status orders (active, unfilled orders)
   *
   * Position Management Logic:
   * - Flag positions with excessive unrealized losses for potential closure
   * - Compare position entry price vs current market price
   * - Uses same deviation threshold as order cancellation
   *
   * @param tradingPair Current trading pair state with orders and positions
   * @param marketState Calculated market state with deviation thresholds
   * @returns Object indicating which risk management actions are recommended
   */
  checkOrdersAndPositions(tradingPair: TradingPair, marketState: MarketState): {
    shouldCancelBid: boolean;
    shouldCancelAsk: boolean;
    shouldClosePositions: boolean;
  } {
    let shouldCancelBid = false;
    let shouldCancelAsk = false;
    let shouldClosePositions = false;

    // Check if bid order is too far from current price
    // Bid orders become risky when placed significantly above market (overpaying)
    if (tradingPair.bidOrder && tradingPair.bidOrder.status === 'NEW') {
      const bidDeviation = calculatePriceDeviation(tradingPair.bidOrder.price, marketState.midPrice);
      if (bidDeviation > marketState.maxDeviationPrice) {
        shouldCancelBid = true;
      }
    }

    // Check if ask order is too far from current price
    // Ask orders become risky when placed significantly below market (underselling)
    if (tradingPair.askOrder && tradingPair.askOrder.status === 'NEW') {
      const askDeviation = calculatePriceDeviation(tradingPair.askOrder.price, marketState.midPrice);
      if (askDeviation > marketState.maxDeviationPrice) {
        shouldCancelAsk = true;
      }
    }

    // Check if positions need to be closed due to excessive deviation
    // Long positions lose money when price falls significantly below entry
    if (tradingPair.longPosition) {
      const longDeviation = calculatePriceDeviation(tradingPair.longPosition.entryPrice, marketState.midPrice);
      if (longDeviation > marketState.maxDeviationPrice) {
        shouldClosePositions = true;
      }
    }

    // Short positions lose money when price rises significantly above entry
    if (tradingPair.shortPosition) {
      const shortDeviation = calculatePriceDeviation(tradingPair.shortPosition.entryPrice, marketState.midPrice);
      if (shortDeviation > marketState.maxDeviationPrice) {
        shouldClosePositions = true;
      }
    }

    return {
      shouldCancelBid,
      shouldCancelAsk,
      shouldClosePositions
    };
  }
}