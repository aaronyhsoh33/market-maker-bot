import { CreateOrderRequest, CancelOrderRequest, OrderResponse } from '../types/orders';

/**
 * Order service interface for exchange trading operations
 *
 * Defines the contract for order execution services that handle trading
 * operations with cryptocurrency exchanges. This abstraction allows the
 * market making system to work with different exchanges without changing
 * the core trading logic.
 *
 * Key responsibilities:
 * - Execute limit orders on the exchange
 * - Cancel existing orders
 * - Provide service health monitoring
 * - Handle exchange-specific API requirements and formatting
 *
 * Implementation examples: EtherealService (Ethereal perp futures DEX)
 */
export interface IOrderService {
  /**
   * Place a new limit order on the exchange
   *
   * Submits a limit order to the exchange with specified price, quantity,
   * and other parameters. The order will be added to the exchange's order
   * book and may be partially or fully filled depending on market conditions.
   *
   * Order Lifecycle:
   * 1. Order is validated and submitted to exchange
   * 2. Exchange returns order ID and initial status
   * 3. Order status updates are received via WebSocket (separate service)
   * 4. Order may be filled, partially filled, or remain open
   *
   * @param orderRequest Complete order specification including price, quantity, side, etc.
   * @returns Order response with exchange order ID and initial status
   * @throws Error if order is rejected by exchange or network issues occur
   */
  placeOrder(orderRequest: CreateOrderRequest): Promise<OrderResponse>;

  /**
   * Cancel one or more existing orders on the exchange
   *
   * Attempts to cancel the specified orders by their exchange order IDs.
   * Orders that are already filled cannot be cancelled. Partially filled
   * orders will have their remaining quantity cancelled.
   *
   * Cancellation Behavior:
   * - Orders in 'NEW' status can typically be cancelled
   * - 'PARTIALLY_FILLED' orders cancel the remaining quantity
   * - 'FILLED' orders cannot be cancelled (will return error/success based on exchange)
   * - Multiple orders can be cancelled in a single request for efficiency
   *
   * @param cancelRequest Cancellation request with order IDs and account information
   * @returns Cancellation response indicating success/failure for each order
   * @throws Error if cancellation request fails or network issues occur
   */
  cancelOrder(cancelRequest: CancelOrderRequest): Promise<OrderResponse>;

  /**
   * Check if the order service is healthy and operational
   *
   * Performs a health check to verify that the order service can communicate
   * with the exchange and is ready to execute trading operations. This is
   * used for monitoring and ensuring the market making system doesn't attempt
   * trades when the exchange is unavailable.
   *
   * Health Check Criteria:
   * - Exchange API is reachable and responding
   * - Authentication is working (if required)
   * - Critical trading endpoints are operational
   * - Network connectivity is stable
   *
   * @returns true if service is healthy and ready for trading, false otherwise
   */
  isHealthy(): Promise<boolean>;
}