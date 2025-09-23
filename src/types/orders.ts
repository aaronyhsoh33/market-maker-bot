/**
 * Order management types for exchange trading operations
 *
 * Defines the data structures used for creating, modifying, and canceling
 * orders on cryptocurrency exchanges. These types conform to exchange
 * API specifications and handle order lifecycle management.
 */

/** Order execution type */
export type OrderType = 'LIMIT' | 'MARKET';

/** Order side as numeric value for API compatibility */
export type OrderSideNumber = 0 | 1; // 0 = BUY, 1 = SELL

/** Time-in-force order duration specifications */
export type TimeInForce = 'GTD' | 'GTC' | 'IOC' | 'FOK';

/**
 * Request structure for creating new orders
 *
 * Contains all parameters needed to place a limit or market order
 * on the exchange, including pricing, quantity, and execution constraints.
 */
export interface CreateOrderRequest {
  /** Order execution type (LIMIT for market making) */
  order_type: OrderType;
  /** Order quantity in base currency units */
  quantity: number;
  /** Order side (0 = BUY, 1 = SELL) */
  side: OrderSideNumber;
  /** Limit price (required for LIMIT orders) */
  price?: number; // Optional for market orders
  /** Trading pair symbol */
  ticker: string;
  /** Client-generated order identifier (optional) */
  client_order_id?: string; // Optional
  /** Order duration specification */
  time_in_force: TimeInForce;
  /** Expiration timestamp for GTD orders (Unix seconds) */
  expires_at?: number; // Required for GTD orders (timestamp)
}

/**
 * Request structure for canceling existing orders
 *
 * Supports bulk order cancellation for efficient risk management
 * and position cleanup during market making operations.
 */
export interface CancelOrderRequest {
  /** List of exchange order IDs to cancel */
  order_ids: string[];
  /** Exchange subaccount identifier */
  subaccount: string;
}

/**
 * Response structure from order operations
 *
 * Generic response type that accommodates different exchange
 * response formats while providing order confirmation data.
 */
export interface OrderResponse {
  /** Flexible response structure for different exchange formats */
  [key: string]: any;
}