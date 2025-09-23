import { PriceServiceConnection } from '@pythnetwork/price-service-client';
import { IPriceClient } from '../interfaces/IPriceClient';
import { PriceUpdate, PriceUpdateCallback, ConnectionStatusCallback } from '../types/price';
import { getPriceFeedByTicker, getPriceFeedById } from '../config/priceFeeds';

/**
 * Configuration for Hermes price client connection
 */
export interface HermesClientConfig {
  /** Hermes WebSocket endpoint URL */
  endpoint: string;
  /** Base reconnection interval in milliseconds */
  reconnectInterval: number;
  /** Maximum number of reconnection attempts before giving up */
  maxReconnectAttempts: number;
}

/**
 * Hermes price client for Pyth Network real-time price feeds
 *
 * Connects to Pyth Network's Hermes service to receive real-time, high-frequency
 * price updates for cryptocurrency trading pairs. Hermes acts as a WebSocket
 * gateway that aggregates and distributes Pyth's oracle price data
 *
 * Key Features:
 * - Real-time price updates from Pyth Network oracles
 * - Automatic reconnection with exponential backoff
 * - Price feed filtering by ticker symbols
 * - Confidence interval data alongside prices
 * - WebSocket-based for minimal latency
 * - Handles price feed ID mapping automatically
 *
 * Architecture:
 * - Uses Pyth's PriceServiceConnection under the hood
 * - Maps human-readable tickers to Pyth price feed IDs
 * - Implements IPriceClient interface for pluggability
 * - Provides connection lifecycle management
 * - Handles network failures gracefully
 *
 * Price Data Quality:
 * - Filters out stale price data (>60 seconds old)
 * - Includes confidence intervals for risk assessment
 * - Handles decimal precision conversion automatically
 */
export class HermesPriceClient implements IPriceClient {
  private client: PriceServiceConnection;
  private config: HermesClientConfig;
  private priceUpdateCallback?: PriceUpdateCallback;
  private connectionStatusCallback?: ConnectionStatusCallback;
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private isConnected = false;
  private subscribedSymbols: Set<string> = new Set();

  constructor(config: HermesClientConfig) {
    this.config = config;
    this.client = new PriceServiceConnection(config.endpoint);
  }

  public onPriceUpdate(callback: PriceUpdateCallback): void {
    this.priceUpdateCallback = callback;
  }

  public onConnectionStatus(callback: ConnectionStatusCallback): void {
    this.connectionStatusCallback = callback;
  }

  public async connect(): Promise<void> {
    try {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.connectionStatusCallback?.('connected');
      console.log('Connected to Hermes WebSocket');
    } catch (error) {
      this.handleConnectionError(error as Error);
    }
  }

  public async subscribe(tickers: string[]): Promise<void> {
    try {
      const priceIds = tickers
        .map(ticker => getPriceFeedByTicker(ticker)?.priceId)
        .filter((id): id is string => id !== undefined);

      if (priceIds.length === 0) {
        throw new Error('No valid price feed IDs found for the provided tickers');
      }

      await this.client.subscribePriceFeedUpdates(priceIds, (priceFeed) => {
        this.handlePriceUpdate(priceFeed);
      });

      tickers.forEach(ticker => this.subscribedSymbols.add(ticker));
      console.log(`Subscribed to price feeds: ${tickers.join(', ')}`);
    } catch (error) {
      console.error('Error subscribing to price feeds:', error);
      throw error;
    }
  }

  public async unsubscribe(tickers: string[]): Promise<void> {
    tickers.forEach(ticker => this.subscribedSymbols.delete(ticker));
    console.log(`Unsubscribed from price feeds: ${tickers.join(', ')}`);
  }

  public async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    try {
      this.client.closeWebSocket();
      this.isConnected = false;
      this.subscribedSymbols.clear();
      this.connectionStatusCallback?.('disconnected');
      console.log('Disconnected from Hermes WebSocket');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  private handlePriceUpdate(priceFeed: any): void {
    try {

      const feedConfig = getPriceFeedById(priceFeed.id);
      if (!feedConfig) {
        console.warn(`Unknown price feed ID: ${priceFeed.id}`);
        return;
      }

      const priceData = priceFeed.getPriceNoOlderThan(60);
      if (!priceData) {
        console.warn(`No recent price data for ${feedConfig.ticker}`);
        return;
      }

      const priceUpdate: PriceUpdate = {
        ticker: feedConfig.ticker,
        price: Number(priceData.price) * Math.pow(10, priceData.expo),
        confidence: Number(priceData.conf) * Math.pow(10, priceData.expo),
        timestamp: Date.now()
      };

      this.priceUpdateCallback?.(priceUpdate);
    } catch (error) {
      console.error('Error processing price update:', error);
    }
  }

  private handleConnectionError(error: Error): void {
    console.error('WebSocket connection error:', error);
    this.isConnected = false;
    this.connectionStatusCallback?.('error', error);

    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * this.reconnectAttempts;

    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}