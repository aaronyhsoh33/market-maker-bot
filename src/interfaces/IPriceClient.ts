import { PriceUpdate, PriceUpdateCallback, ConnectionStatusCallback } from '../types/price';

/**
 * Price client interface for real-time market data
 *
 * Defines the contract for price feed clients that provide real-time market data
 * to the market making system. This abstraction allows the system to work with
 * different price feed providers (Pyth Network, Chainlink, exchange APIs, etc.)
 * without changing the core market making logic.
 *
 * Key responsibilities:
 * - Establish and maintain real-time price feed connections
 * - Subscribe to specific trading pair price updates
 * - Notify subscribers when price updates arrive
 * - Handle connection lifecycle and error conditions
 *
 * Implementation examples: HermesPriceClient (Pyth Network via Hermes)
 */
export interface IPriceClient {
  /**
   * Register callback for price update notifications
   *
   * The callback will be invoked whenever a new price update is received
   * for any subscribed trading pair. The market making system uses this
   * to trigger quote refresh cycles and order adjustments.
   *
   * @param callback Function to call when price updates are received
   */
  onPriceUpdate(callback: PriceUpdateCallback): void;

  /**
   * Register callback for connection status changes
   *
   * Notifies the system when the price feed connection status changes,
   * allowing for proper error handling and reconnection logic.
   *
   * @param callback Function to call when connection status changes
   */
  onConnectionStatus(callback: ConnectionStatusCallback): void;

  /**
   * Establish connection to the price feed service
   *
   * Initiates the connection to the underlying price feed provider.
   * Should handle authentication, WebSocket setup, and any required
   * initialization procedures.
   *
   * @throws Error if connection cannot be established
   */
  connect(): Promise<void>;

  /**
   * Close connection to the price feed service
   *
   * Cleanly shuts down the price feed connection, unsubscribing from
   * all price feeds and releasing any resources. Should be called
   * during application shutdown.
   */
  disconnect(): Promise<void>;

  /**
   * Get current connection status
   *
   * Returns the current connection state, useful for health checks
   * and determining if the price feed is operational.
   *
   * @returns true if connected and receiving data, false otherwise
   */
  getConnectionStatus(): boolean;

  /**
   * Subscribe to price updates for specific trading pairs
   *
   * Starts receiving real-time price updates for the specified trading pairs.
   * The system will call the registered price update callback whenever
   * new price data arrives for any of these pairs.
   *
   * @param tickers Array of trading pair symbols to subscribe to (e.g., ['BTCUSD', 'ETHUSD'])
   * @throws Error if subscription fails or tickers are invalid
   */
  subscribe(tickers: string[]): Promise<void>;

  /**
   * Unsubscribe from price updates for specific trading pairs
   *
   * Stops receiving price updates for the specified trading pairs.
   * Used to reduce bandwidth and processing when certain pairs are
   * no longer needed for market making.
   *
   * @param tickers Array of trading pair symbols to unsubscribe from
   */
  unsubscribe(tickers: string[]): Promise<void>;
}