import axios, { AxiosInstance } from 'axios';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { IOrderService } from '../interfaces/IOrderService';
import { CreateOrderRequest, CancelOrderRequest, OrderResponse } from '../types/orders';
import { parseSignatureType } from '../utils/orderUtils';

dotenv.config();

/**
 * Ethereal API order data structure for POST /v1/order
 */
export interface EtherealOrderData {
  /** Subaccount identifier */
  subaccount: string;
  /** Sender address */
  sender: string;
  /** Order nonce */
  nonce: string;
  /** Order type */
  type: string;
  /** Order quantity */
  quantity: string;
  /** Order side (0 = BUY, 1 = SELL) */
  side: number;
  /** Onchain ID */
  onchainId: number;
  /** Engine type */
  engineType: number;
  /** Reduce only flag */
  reduceOnly: boolean;
  /** Close position flag */
  close: boolean;
  /** Signed timestamp */
  signedAt: number;
  /** Expiration timestamp */
  expiresAt: number;
  /** Order price (for LIMIT orders) */
  price?: string;
  /** Time in force */
  timeInForce?: string;
  /** Post only flag */
  postOnly?: boolean;
  /** Client order ID */
  clientOrderId?: string;
  /** Stop price */
  stopPrice?: string;
  /** Stop type */
  stopType?: number;
  /** Group ID */
  groupId?: string;
  /** Group contingency type */
  groupContingencyType?: number;
}

/**
 * RPC Config response structure
 */
export interface RpcConfigResponse {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  signatureTypes: {
    [key: string]: string; // String format like "address sender,bytes32 subaccount,..."
  };
}

/**
 * Default EIP-712 Domain for Ethereal (fallback)
 */
const DEFAULT_DOMAIN = {
  name: 'Ethereal',
  version: '1',
  chainId: 13374202,
  verifyingContract: '0x5F7B4B4D4266f29f0B5eF8ccf3aB0f466194C775'
};

/**
 * TradeOrder interface matching Ethereal specification
 */
export interface TradeOrder {
  sender: string; // Address
  subaccount: string; // Hex
  quantity: bigint;
  price: bigint;
  reduceOnly: boolean;
  side: number; // OrderSide
  engineType: number; // EngineType
  productId: number;
  nonce: bigint;
  signedAt: bigint;
}

/**
 * CancelOrder interface matching Ethereal specification
 */
export interface CancelOrder {
  sender: string; // Address
  subaccount: string; // Hex
  nonce: bigint;
  orderIds: string[]; // bytes32[]
  clientOrderIds: string[]; // bytes32[]
}

/**
 * Default EIP-712 TradeOrder type definition (fallback)
 */
const DEFAULT_TRADE_ORDER_TYPES = {
  TradeOrder: [
    { name: 'sender', type: 'address' },
    { name: 'subaccount', type: 'bytes32' },
    { name: 'quantity', type: 'uint128' },
    { name: 'price', type: 'uint128' },
    { name: 'reduceOnly', type: 'bool' },
    { name: 'side', type: 'uint8' },
    { name: 'engineType', type: 'uint8' },
    { name: 'productId', type: 'uint32' },
    { name: 'nonce', type: 'uint64' },
    { name: 'signedAt', type: 'uint64' }
  ]
};

/**
 * Ethereal API cancel order data structure
 */
export interface EtherealCancelOrderData {
  /** Sender address */
  sender: string;
  /** Subaccount identifier */
  subaccount: string;
  /** Cancel nonce */
  nonce: string;
  /** Order IDs to cancel */
  orderIds: string[];
}

/**
 * Complete request structure for Ethereal API order
 */
export interface EtherealOrderRequest {
  /** Order data */
  data: EtherealOrderData;
  /** Order signature */
  signature: string;
}

/**
 * Complete request structure for Ethereal API cancel order
 */
export interface EtherealCancelOrderRequest {
  /** Cancel order data */
  data: EtherealCancelOrderData;
  /** Cancel signature */
  signature: string;
}

/**
 * Configuration for Ethereal exchange service connections
 */
export interface EtherealServiceConfig {
  /** Private key for signing orders (hex string without 0x prefix). If not provided, will use ETHEREAL_PRIVATE_KEY from .env */
  privateKey?: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Subaccount identifier for orders */
  subaccount?: string;
  /** Product ID mapping for ticker symbols */
  productIdMap?: { [ticker: string]: number };
}

/**
 * Convert Gwei string to wei bigint (multiply by 10^9)
 */
const gweiToWei = (gwei: string): bigint => {
  return ethers.parseUnits(gwei, 9);
};

/**
 * Ethereal dex integration service
 *
 * Provides order execution and account management capabilities through direct Ethereal API integration
 * - Direct API: Direct connection to Ethereal API using EIP-712 signatures
 * - No proxy: Eliminates dependency on local Python client
 *
 * Key Features:
 * - Order placement and cancellation via direct API
 * - Position querying with product filtering
 * - Health monitoring for API endpoints
 * - Automatic error handling and logging
 * - Support for bulk order operations
 * - EIP-712 signature generation for direct API integration
 */
export class EtherealService implements IOrderService {
  private client: AxiosInstance;
  private config: EtherealServiceConfig;
  private privateKey: string;
  private domain: any = null;
  private signatureTypes: any = null;
  private configPromise: Promise<void> | null = null;

  /**
   * Initialize Ethereal service with direct API configuration
   *
   * @param config Service configuration with private key and optional settings
   */
  constructor(config: EtherealServiceConfig) {
    this.config = config;

    // Set up private key for direct API integration
    this.privateKey = config.privateKey || process.env.ETHEREAL_PRIVATE_KEY || '';
    if (!this.privateKey) {
      throw new Error('Private key is required. Provide it in config or set ETHEREAL_PRIVATE_KEY environment variable.');
    }

    // Direct client for Ethereal API
    this.client = axios.create({
      baseURL: process.env.ETHEREAL_API_BASE_URL || 'https://api.etherealtest.net/v1',
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Fetch configuration from /v1/rpc/config endpoint
   */
  private async loadConfig(): Promise<void> {
    if (this.configPromise) {
      return this.configPromise;
    }

    this.configPromise = this.fetchConfig();
    return this.configPromise;
  }

  private async fetchConfig(): Promise<void> {
    try {
      console.log('Fetching Ethereal configuration...');
      const response = await this.client.get('/rpc/config');
      const config: RpcConfigResponse = response.data;

      this.domain = config.domain;

      // Parse signature types from string format to EIP-712 format
      this.signatureTypes = {};
      for (const [typeName, typeString] of Object.entries(config.signatureTypes)) {
        this.signatureTypes[typeName] = parseSignatureType(typeString);
      }

      console.log('Configuration loaded successfully:');
      console.log('Domain:', this.domain);
      console.log('TradeOrder signature type:', this.signatureTypes.TradeOrder);
      console.log('CancelOrder signature type:', this.signatureTypes.CancelOrder);
    } catch (error) {
      console.warn('Failed to fetch config from API, using defaults:', error);
      this.domain = DEFAULT_DOMAIN;
      this.signatureTypes = DEFAULT_TRADE_ORDER_TYPES;
    }
  }

  /**
   * Create EIP-712 signature for cancel order data
   *
   * @param cancelData The cancel order data to sign
   * @returns EIP-712 signature string
   */
  private async createCancelSignature(cancelData: EtherealCancelOrderData): Promise<string> {
    // Ensure config is loaded
    await this.loadConfig();

    const wallet = new ethers.Wallet(this.privateKey);
    const domain = this.domain || DEFAULT_DOMAIN;

    // Use the correct CancelOrder signature type (override config if needed)
    const correctCancelOrderType = [
      { name: 'sender', type: 'address' },
      { name: 'subaccount', type: 'bytes32' },
      { name: 'nonce', type: 'uint64' },
      { name: 'orderIds', type: 'bytes32[]' },
      { name: 'clientOrderIds', type: 'bytes32[]' }
    ];

    const signatureTypes = { CancelOrder: correctCancelOrderType };

    // Convert UUIDs to bytes32 format (matches working example)
    const uuidToBytes32 = (uuid: string): string => {
      return ethers.zeroPadValue(`0x${uuid.replace(/-/g, '')}`, 32);
    };

    // Create message exactly like the working example
    const message = {
      sender: cancelData.sender || wallet.address,
      subaccount: cancelData.subaccount,
      nonce: BigInt(cancelData.nonce),
      orderIds: cancelData.orderIds.map(uuidToBytes32),
      clientOrderIds: [] // Empty array as required by signature type but not used in actual signing
    };

    console.log('Cancel Message:', message);

    // Sign using EIP-712 with dynamically loaded config
    const signature = await wallet.signTypedData(
      domain,
      signatureTypes,
      message
    );

    return signature;
  }

  /**
   * Create EIP-712 signature for the order data
   *
   * @param orderData The order data to sign
   * @returns EIP-712 signature string
   */
  private async createSignature(orderData: EtherealOrderData): Promise<string> {
    // Ensure config is loaded
    await this.loadConfig();

    const wallet = new ethers.Wallet(this.privateKey);
    const domain = this.domain || DEFAULT_DOMAIN;
    const signatureTypes = { TradeOrder: this.signatureTypes?.TradeOrder || DEFAULT_TRADE_ORDER_TYPES.TradeOrder };

    // Convert order data to TradeOrder message format following the exact specification
    const message: TradeOrder = {
      sender: orderData.sender || wallet.address,
      subaccount: orderData.subaccount,
      quantity: gweiToWei(orderData.quantity), // Always convert quantity to Gwei
      price: orderData.type === 'LIMIT' && orderData.price ? gweiToWei(orderData.price) : 0n, // Convert price to Gwei only for LIMIT orders
      reduceOnly: orderData.reduceOnly ?? false,
      side: orderData.side,
      engineType: orderData.engineType,
      productId: orderData.onchainId,
      nonce: BigInt(orderData.nonce),
      signedAt: BigInt(orderData.signedAt) // Use seconds as-is for EIP-712 message
    };

    console.log('Message:', message);

    // Sign using EIP-712 with dynamically loaded config
    const signature = await wallet.signTypedData(
      domain,
      signatureTypes,
      message
    );

    return signature;
  }

  /**
   * Generate a nonce using current timestamp in nanoseconds
   *
   * @returns Nonce string
   */
  public static generateNonce(): string {
    // Get current timestamp in nanoseconds (microseconds * 1000)
    const now = Date.now() * 1000000; // Convert milliseconds to nanoseconds
    return now.toString();
  }

  /**
   * Get current timestamp in seconds for signedAt field
   *
   * @returns Current timestamp in seconds
   */
  public static getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Place a limit order on Ethereal exchange via direct API
   *
   * Submits order to Ethereal API using EIP-712 signatures. Orders are submitted as GTD (Good Till Date)
   * with specified expiration times.
   *
   * @param orderRequest Complete order specification (price, quantity, side, etc.)
   * @returns Order response with exchange order ID and initial status
   * @throws Error if order is rejected or network issues occur
   */
  async placeOrder(orderRequest: CreateOrderRequest): Promise<OrderResponse> {
    try {
      // Get wallet address for sender
      const wallet = new ethers.Wallet(this.privateKey);
      
      // Get subaccount from config or use default
      const subaccount = this.config.subaccount || '0x0000000000000000000000000000000000000000000000000000000000000000';

      // Convert CreateOrderRequest to EtherealOrderData format
      const etherealOrderData: EtherealOrderData = {
        subaccount: subaccount,
        sender: wallet.address,
        nonce: EtherealService.generateNonce(),
        type: orderRequest.order_type,
        quantity: orderRequest.quantity.toString(),
        side: orderRequest.side,
        onchainId: orderRequest.onchainId,
        engineType: 0,
        reduceOnly: false,
        close: false,
        signedAt: EtherealService.getCurrentTimestamp(),
        expiresAt: orderRequest.expires_at || (EtherealService.getCurrentTimestamp() + 3600),
        price: orderRequest.price?.toString(),
        timeInForce: orderRequest.time_in_force,
        clientOrderId: orderRequest.client_order_id
      };

      // Create signature and submit order
      const signature = await this.createSignature(etherealOrderData);
      const orderRequestData: EtherealOrderRequest = {
        data: etherealOrderData,
        signature
      };

      const response = await this.client.post('/order', orderRequestData);
      return response.data;
    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    }
  }

  /**
   * Cancel one or more orders on Ethereal exchange via direct API
   *
   * Supports bulk cancellation for efficient risk management using EIP-712 signatures.
   *
   * @param cancelRequest Cancellation request with order IDs and subaccount
   * @returns Cancellation response indicating success/failure
   * @throws Error if cancellation fails or network issues occur
   */
  async cancelOrder(cancelRequest: CancelOrderRequest): Promise<OrderResponse> {
    try {
      // Get wallet address for sender
      const wallet = new ethers.Wallet(this.privateKey);
      
      // Get subaccount from config or use the one from cancelRequest
      const subaccount = this.config.subaccount || cancelRequest.subaccount || '0x0000000000000000000000000000000000000000000000000000000000000000';

      // Convert CancelOrderRequest to EtherealCancelOrderData format
      const etherealCancelData: EtherealCancelOrderData = {
        sender: wallet.address,
        subaccount: subaccount,
        nonce: EtherealService.generateNonce(),
        orderIds: cancelRequest.order_ids
      };

      const signature = await this.createCancelSignature(etherealCancelData);
      const cancelRequestData: EtherealCancelOrderRequest = {
        data: etherealCancelData,
        signature
      };

      const response = await this.client.post('/order/cancel', cancelRequestData);
      return response.data;
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  /**
   * Fetch product information for a given ticker
   *
   * @param ticker The ticker symbol (e.g., 'BTCUSD')
   * @returns Product information including onchainId, tickSize, etc.
   */
  async fetchProductInfo(ticker: string): Promise<{tickSize: number, minQuantity: number, maxQuantity: number, productId: string, onchainId: number}> {
    const url = `/product?ticker=${ticker}`;

    try {
      console.log(`Fetching product info from: ${this.client.defaults.baseURL}${url}`);
      const response = await this.client.get(url);
      console.log(`Product API response for ${ticker}:`, JSON.stringify(response.data, null, 2));

      if (response.data && response.data.data && response.data.data.length > 0) {
        const product = response.data.data[0];
        console.log(`Product data for ${ticker}:`, product);
        
        const result = {
          tickSize: parseFloat(product.tickSize),
          minQuantity: parseFloat(product.minQuantity),
          maxQuantity: parseFloat(product.maxQuantity),
          productId: product.id,
          onchainId: parseInt(product.onchainId)
        };
        console.log(`Parsed product info for ${ticker}:`, result);
        return result;
      } else {
        throw new Error(`No product data found for ${ticker}`);
      }
    } catch (error) {
      console.error(`Error fetching product info for ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Check overall health of API endpoint
   *
   * Ensures trading capabilities are operational before allowing market making activities to proceed.
   *
   * @returns true if endpoint is healthy, false otherwise
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
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

      const response = await this.client.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching positions:', error);
      throw error;
    }
  }
}