import { OrderUpdateCallback, OrderFillCallback, WebSocketStatusCallback } from '../types/orderUpdates';

/**
 * Order update client interface for real-time trading event notifications
 *
 * Defines the contract for WebSocket clients that provide real-time updates
 * about order status changes and trade executions. This allows the market
 * making system to react immediately to order fills, cancellations, and
 * other trading events without polling the exchange APIs.
 *
 * Key responsibilities:
 * - Establish and maintain WebSocket connections to exchange
 * - Subscribe to order status change notifications
 * - Subscribe to trade fill notifications
 * - Handle connection lifecycle and reconnection logic
 * - Notify subscribers of real-time trading events
 *
 * Implementation examples: EtherealWebSocketClient (Ethereal perp DEX)
 */
export interface IOrderUpdateClient {
  /**
   * Establish WebSocket connection to the exchange
   *
   * Initiates the WebSocket connection for receiving real-time order
   * and fill updates. Should handle authentication, subscription setup,
   * and connection state management.
   *
   * @throws Error if connection cannot be established
   */
  connect(): Promise<void>;

  /**
   * Close WebSocket connection to the exchange
   *
   * Cleanly shuts down the WebSocket connection, unsubscribing from
   * all channels and releasing resources. Should be called during
   * application shutdown.
   */
  disconnect(): void;

  /**
   * Subscribe to order status change notifications
   *
   * Registers for real-time notifications when orders change status
   * (NEW -> PARTIALLY_FILLED -> FILLED, or cancellation events).
   * Critical for market making systems that need to know immediately
   * when orders are filled to avoid over-positioning.
   *
   * @param subaccountId Exchange subaccount ID to monitor
   * @param callback Function to call when order status changes
   */
  subscribeToOrderUpdates(subaccountId: string, callback: OrderUpdateCallback): void;

  /**
   * Subscribe to trade execution notifications
   *
   * Registers for real-time notifications when orders are filled
   * (fully or partially). Provides detailed fill information including
   * execution price, quantity, and fees. Used for P&L tracking and
   * position management.
   *
   * @param subaccountId Exchange subaccount ID to monitor
   * @param callback Function to call when trades are executed
   */
  subscribeToOrderFills(subaccountId: string, callback: OrderFillCallback): void;

  /**
   * Unsubscribe from order status change notifications
   *
   * Stops receiving order update notifications for the specified
   * subaccount. Used when shutting down or switching accounts.
   *
   * @param subaccountId Exchange subaccount ID to stop monitoring
   */
  unsubscribeFromOrderUpdates(subaccountId: string): void;

  /**
   * Unsubscribe from trade execution notifications
   *
   * Stops receiving fill notifications for the specified subaccount.
   * Used when shutting down or switching accounts.
   *
   * @param subaccountId Exchange subaccount ID to stop monitoring
   */
  unsubscribeFromOrderFills(subaccountId: string): void;

  /**
   * Register callback for WebSocket connection status changes
   *
   * Notifies the system when the WebSocket connection status changes,
   * enabling proper error handling and reconnection logic. Critical
   * for ensuring reliable real-time data delivery.
   *
   * @param callback Function to call when connection status changes
   */
  onConnectionStatus(callback: WebSocketStatusCallback): void;

  /**
   * Get current WebSocket connection status
   *
   * Returns the current connection state for health checks and
   * monitoring purposes. Used to determine if real-time updates
   * are being received.
   *
   * @returns true if connected and receiving data, false otherwise
   */
  isConnected(): boolean;
}