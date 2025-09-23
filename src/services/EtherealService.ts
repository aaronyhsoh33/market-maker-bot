import axios, { AxiosInstance } from 'axios';
import { IOrderService } from '../interfaces/IOrderService';
import { CreateOrderRequest, CancelOrderRequest, OrderResponse } from '../types/orders';

/**
 * Configuration for Ethereal exchange service connections
 */
export interface EtherealServiceConfig {
  /** Local proxy/gateway URL for order operations */
  localBaseUrl: string;
  /** Direct Ethereal API URL for data queries */
  apiBaseUrl: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
}

/**
 * Ethereal dex integration service
 *
 * Provides order execution and account management capabilities through Ethereal API
 * - Local client: Routes order operations through a local proxy
 * - API client: Direct connection to Ethereal for data queries and positions
 *
 * Key Features:
 * - Order placement and cancellation
 * - Position querying with product filtering
 * - Health monitoring for both local and API endpoints
 * - Automatic error handling and logging
 * - Support for bulk order operations
 */
export class EtherealService implements IOrderService {
  private localClient: AxiosInstance;
  private apiClient: AxiosInstance;
  private config: EtherealServiceConfig;

  /**
   * Initialize Ethereal service with dual HTTP client configuration
   *
   * @param config Service configuration with local and API endpoint URLs
   */
  constructor(config: EtherealServiceConfig) {
    this.config = config;

    // Local client for order operations
    this.localClient = axios.create({
      baseURL: config.localBaseUrl,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // API client for other Ethereal operations
    this.apiClient = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Place a limit order on Ethereal exchange via local proxy
   *
   * Submits order to Ethereal API. Orders are submitted as GTD (Good Till Date)
   * with specified expiration times.
   *
   * @param orderRequest Complete order specification (price, quantity, side, etc.)
   * @returns Order response with exchange order ID and initial status
   * @throws Error if order is rejected or network issues occur
   */
  async placeOrder(orderRequest: CreateOrderRequest): Promise<OrderResponse> {
    try {
      const response = await this.localClient.post('/orders', orderRequest);
      return response.data;
    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    }
  }

  /**
   * Cancel one or more orders on Ethereal exchange via local proxy
   *
   * Supports bulk cancellation for efficient risk management.
   *
   * @param cancelRequest Cancellation request with order IDs and subaccount
   * @returns Cancellation response indicating success/failure
   * @throws Error if cancellation fails or network issues occur
   */
  async cancelOrder(cancelRequest: CancelOrderRequest): Promise<OrderResponse> {
    try {
      const response = await this.localClient.post('/orders/cancel', cancelRequest);
      return response.data;
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  /**
   * Check overall health of both local and API endpoints
   *
   * Ensures both trading and data access capabilities are operational
   * before allowing market making activities to proceed.
   *
   * @returns true if both endpoints are healthy, false otherwise
   */
  async isHealthy(): Promise<boolean> {
    try {
      const localHealthy = await this.isLocalHealthy();
      const apiHealthy = await this.isApiHealthy();
      return localHealthy && apiHealthy;
    } catch (error) {
      return false;
    }
  }

  async isLocalHealthy(): Promise<boolean> {
    try {
      const response = await this.localClient.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async isApiHealthy(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getPositions(subaccountId: string, productIds?: string[]): Promise<any> {
    try {
      let url = `/position?subaccountId=${subaccountId}&open=true`;

      // Add productIds if provided
      if (productIds && productIds.length > 0) {
        const productIdsParam = productIds.map(id => `productIds=${id}`).join('&');
        url += `&${productIdsParam}`;
      }

      const response = await this.apiClient.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching positions:', error);
      throw error;
    }
  }
}