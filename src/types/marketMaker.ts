/**
 * Core market making domain types and interfaces
 *
 * This module defines the fundamental data structures used throughout
 * the market making bot for orders, positions, and market state tracking.
 */

/**
 * Order side designation for market making operations
 * - BID: Buy order (long side)
 * - ASK: Sell order (short side)
 */
export type OrderSide = 'BID' | 'ASK';

/**
 * Order status as returned by Ethereal exchange
 * - NEW: Order placed but not yet filled
 * - FILLED: Order completely executed
 * - PARTIALLY_FILLED: Order partially executed, remaining quantity active
 * - CANCELED: Order cancelled before full execution
 * - EXPIRED: Order expired (GTD orders)
 */
export type OrderStatus = 'NEW' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELED' | 'EXPIRED';

/**
 * Position side for tracking open positions
 * - LONG: Positive position (bought more than sold)
 * - SHORT: Negative position (sold more than bought)
 */
export type PositionSide = 'LONG' | 'SHORT';

/**
 * Order representation in the market making system
 * Tracks both actual exchange orders and virtual position-based orders
 */
export interface Order {
  /** Unique order identifier from the exchange or generated for virtual orders */
  id: string;
  /** Trading pair symbol (e.g., 'BTCUSD', 'ETHUSD') */
  ticker: string;
  /** Order side (BID for buy, ASK for sell) */
  side: OrderSide;
  /** Order price in quote currency */
  price: number;
  /** Total order quantity */
  quantity: number;
  /** Amount of the order that has been filled */
  quantityFilled: number;
  /** Current order status */
  status: OrderStatus;
  /** Order creation timestamp (Unix milliseconds) */
  timestamp: number;
}

/**
 * Position representation for tracking open market positions
 * Used to convert existing positions into virtual orders for market making logic
 */
export interface Position {
  /** Trading pair symbol */
  ticker: string;
  /** Position direction (LONG or SHORT) */
  side: PositionSide;
  /** Position size (always positive, direction indicated by side) */
  quantity: number;
  /** Average entry price for the position */
  entryPrice: number;
  /** Position creation timestamp (Unix milliseconds) */
  timestamp: number;
}

/**
 * Trading pair state for market making operations
 *
 * Represents the complete state of market making for a single trading pair,
 * including active orders and existing positions. The market maker uses this
 * to determine when to create new orders or cancel existing ones.
 *
 * Key business logic:
 * - If bidOrder exists, don't create new bid orders
 * - If askOrder exists, don't create new ask orders
 * - Existing positions are treated as filled orders to prevent over-positioning
 * - Long position = filled bid order (don't create new bid)
 * - Short position = filled ask order (don't create new ask)
 */
export interface TradingPair {
  /** Trading pair symbol */
  ticker: string;
  /** Active bid (buy) order, if any */
  bidOrder?: Order;
  /** Active ask (sell) order, if any */
  askOrder?: Order;
  /** Existing long position, if any */
  longPosition?: Position;
  /** Existing short position, if any */
  shortPosition?: Position;
}

/**
 * Market state snapshot for price deviation checking
 *
 * Contains calculated market prices and deviation thresholds used by
 * the DeviationCheckService to determine if orders should be cancelled
 * due to excessive price movement.
 */
export interface MarketState {
  /** Trading pair symbol */
  ticker: string;
  /** Current mid/reference price */
  midPrice: number;
  /** Calculated optimal bid price (mid - spread/2) */
  bidPrice: number;
  /** Calculated optimal ask price (mid + spread/2) */
  askPrice: number;
  /** Maximum allowed price deviation before order cancellation */
  maxDeviationPrice: number;
  /** State calculation timestamp (Unix milliseconds) */
  timestamp: number;
}