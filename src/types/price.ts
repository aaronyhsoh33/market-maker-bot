/**
 * Price data types for real-time market data feeds
 *
 * Defines the core data structures used for receiving and processing
 * real-time price updates from various oracle and exchange sources.
 */

/**
 * Real-time price update from oracle or exchange feed
 *
 * Contains the essential price information needed for market making
 * decisions, including confidence intervals for risk assessment.
 */
export interface PriceUpdate {
  /** Trading pair symbol (e.g., 'BTCUSD', 'ETHUSD') */
  ticker: string;
  /** Current price in quote currency */
  price: number;
  /** Price confidence interval (higher = more reliable) */
  confidence: number;
  /** Update timestamp in Unix milliseconds */
  timestamp: number;
}

/**
 * Configuration for price feed client connections
 *
 * Generic configuration interface for price clients, providing
 * connection settings and subscription parameters.
 */
export interface PriceClientConfig {
  /** Price feed service endpoint URL */
  endpoint: string;
  /** List of trading pairs to subscribe to */
  tickers: string[];
  /** Base interval between reconnection attempts (milliseconds) */
  reconnectInterval: number;
  /** Maximum reconnection attempts before giving up */
  maxReconnectAttempts: number;
}

/**
 * Callback function type for receiving price updates
 *
 * Called whenever a new price update is received for any subscribed
 * trading pair. The market making system uses this to trigger quote
 * refresh cycles and order adjustments.
 */
export type PriceUpdateCallback = (priceUpdate: PriceUpdate) => void;

/**
 * Callback function type for price feed connection status changes
 *
 * Notifies the system when price feed connectivity changes, enabling
 * proper error handling and system health monitoring.
 */
export type ConnectionStatusCallback = (status: 'connected' | 'disconnected' | 'error', error?: Error) => void;