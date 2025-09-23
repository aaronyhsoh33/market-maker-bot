/**
 * Real-time order update types for exchange WebSocket events
 *
 * Defines data structures for receiving and processing real-time
 * order status changes and trade executions from exchange WebSocket feeds.
 */

/** Available WebSocket stream types for order events */
export type OrderUpdateStreamType = 'OrderUpdate' | 'OrderFill';

/**
 * Subscription request for WebSocket order event streams
 *
 * Specifies which type of events to receive for a specific subaccount,
 * enabling targeted real-time notifications.
 */
export interface OrderUpdateSubscription {
  /** Type of events to subscribe to */
  type: OrderUpdateStreamType;
  /** Exchange subaccount identifier to monitor */
  subaccountId: string;
}

/**
 * Order status change event from exchange WebSocket
 *
 * Contains information about order lifecycle changes such as
 * fills, cancellations, or status transitions. Critical for
 * market making systems to track order states in real-time.
 */
export interface OrderUpdateEvent {
  /** Exchange order ID */
  id: string;
  /** Current order status */
  status: string;
  /** Additional event data from exchange */
  [key: string]: any;
}

/**
 * Trade execution event from exchange WebSocket
 *
 * Provides detailed information about order fills including
 * execution price, quantity, and fees. Used for P&L tracking
 * and position management in market making operations.
 */
export interface OrderFillEvent {
  /** Trade execution details and metadata */
  [key: string]: any;
}

/**
 * Callback function type for order status change notifications
 *
 * Invoked when orders change status (NEW -> FILLED, cancellations, etc.),
 * allowing immediate reaction to order lifecycle events.
 */
export type OrderUpdateCallback = (event: OrderUpdateEvent) => void;

/**
 * Callback function type for trade execution notifications
 *
 * Called when orders are filled (fully or partially), providing
 * real-time trade execution data for position and risk management.
 */
export type OrderFillCallback = (event: OrderFillEvent) => void;

/**
 * Callback function type for WebSocket connection status changes
 *
 * Notifies the system of WebSocket connectivity issues, enabling
 * proper error handling and reconnection logic for reliable
 * real-time data delivery.
 */
export type WebSocketStatusCallback = (status: 'connected' | 'disconnected' | 'error', error?: Error) => void;