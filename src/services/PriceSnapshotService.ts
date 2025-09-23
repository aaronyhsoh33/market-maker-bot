import { PriceUpdate } from '../types/price';
import { PriceSnapshot, SnapshotStorage, SnapshotCallback } from '../types/snapshot';
import { TradingPair, Order, OrderStatus } from '../types/marketMaker';
import { DeviationCheckService } from './DeviationCheckService';
import { EtherealService } from './EtherealService';
import { CreateOrderRequest, CancelOrderRequest } from '../types/orders';
import { generateExpiresAt, convertSideToNumber } from '../utils/orderUtils';
import { calculateBidPrice, calculateAskPrice, roundToTickSize } from '../utils/priceUtils';
import { AssetConfig } from '../config/marketConfig';
import { OrderUpdateEvent } from '../types/orderUpdates';

/**
 * Central orchestrator for market making operations
 *
 * The PriceSnapshotService is the core engine of the market making system,
 * responsible for coordinating all trading activities across multiple assets.
 * It manages the complete lifecycle of market making: price monitoring,
 * order placement, position tracking, risk management, and order cancellation.
 *
 * Core Responsibilities:
 * 1. **Price Monitoring**: Receives real-time price updates and maintains price snapshots
 * 2. **Trading Logic**: Determines when to place/cancel orders based on market conditions
 * 3. **Order Management**: Creates, tracks, and cancels limit orders across multiple pairs
 * 4. **Position Awareness**: Integrates existing positions into trading decisions
 * 5. **Risk Management**: Works with DeviationCheckService to prevent excessive losses
 * 6. **Concurrency Control**: Prevents duplicate orders during high-frequency operations
 *
 * Market Making Strategy:
 * - Maintains bid and ask orders for each configured trading pair
 * - Places orders at optimal prices based on current market + configured spread
 * - Cancels orders that deviate too far from current market prices
 * - Avoids over-positioning by treating existing positions as filled orders
 * - Supports sub-second quote refresh cycles for high-frequency market making
 *
 * Architecture:
 * - Event-driven: Reacts to price updates and order status changes
 * - Asynchronous: All operations are non-blocking to maintain responsiveness
 * - Thread-safe: Uses concurrency locks to prevent race conditions
 * - Modular: Integrates with pluggable price clients and order services
 *
 * Lifecycle:
 * 1. Initialize with dependencies (price client, order service, config)
 * 2. Load existing positions to avoid conflicts
 * 3. Start price monitoring and quote refresh timer
 * 4. React to price updates by adjusting orders
 * 5. Handle order status updates from exchange
 * 6. Graceful shutdown with order cancellation
 */
export class PriceSnapshotService {
  private snapshots: SnapshotStorage = {};
  private latestPrices: Map<string, PriceUpdate> = new Map();
  private tradingPairs: Map<string, TradingPair> = new Map();
  private assetConfigs: Map<string, AssetConfig> = new Map();
  private snapshotTimer?: NodeJS.Timeout;
  private snapshotCallback?: SnapshotCallback;
  private quoteRefreshCycle: number;
  private deviationCheckService?: DeviationCheckService;
  private etherealService?: EtherealService;

  // Concurrency control
  private orderCreationInProgress: Set<string> = new Set();
  private orderCancellationInProgress: Set<string> = new Set();

  /**
   * Initialize the Price Snapshot Service
   *
   * @param quoteRefreshCycle How often to refresh quotes and check orders (milliseconds)
   */
  constructor(quoteRefreshCycle: number) {
    this.quoteRefreshCycle = quoteRefreshCycle;
  }

  /**
   * Inject risk management service for price deviation checking
   *
   * @param service DeviationCheckService instance for managing trading risks
   */
  public setDeviationCheckService(service: DeviationCheckService): void {
    this.deviationCheckService = service;
  }

  /**
   * Inject order execution service for exchange operations
   *
   * @param service EtherealService instance for placing and canceling orders
   */
  public setEtherealService(service: EtherealService): void {
    this.etherealService = service;
  }

  /**
   * Configure trading parameters for a specific asset
   *
   * Must be called for each trading pair before starting market making.
   * Contains order size, spread, deviation limits, and exchange constraints.
   *
   * @param ticker Trading pair symbol (e.g., 'BTCUSD')
   * @param config Asset-specific trading configuration
   */
  public setAssetConfig(ticker: string, config: AssetConfig): void {
    this.assetConfigs.set(ticker, config);
  }

  /**
   * Process real-time order status updates from exchange WebSocket
   *
   * Handles order lifecycle events (fills, cancellations, expirations) by
   * updating internal trading pair state. This is critical for:
   * - Knowing when orders are filled to avoid over-positioning
   * - Removing cancelled/expired orders from tracking
   * - Triggering cleanup of completed trading cycles
   *
   * Order State Transitions:
   * - NEW -> PARTIALLY_FILLED -> FILLED (normal execution)
   * - NEW -> CANCELED (manual cancellation or risk management)
   * - NEW -> EXPIRED (GTD order expiration)
   *
   * @param orderUpdate Real-time order status update from exchange
   */
  public updateOrderStatus(orderUpdate: OrderUpdateEvent): void {
    // Find the order in our trading pairs and update its status
    const orderId = orderUpdate.id;
    const status = orderUpdate.status;

    for (const [ticker, tradingPair] of this.tradingPairs.entries()) {
      let orderUpdated = false;

      // Check bid order
      if (tradingPair.bidOrder?.id === orderId) {
        if (status === 'CANCELED' || status === 'EXPIRED') {
          // Remove the order since it's no longer active
          tradingPair.bidOrder = undefined;
          orderUpdated = true;
          console.log(`[${ticker}] Bid order ${orderId} ${status.toLowerCase()}`);
        } else if (tradingPair.bidOrder) {
          // Update the order status
          tradingPair.bidOrder.status = status as OrderStatus;
          orderUpdated = true;
        }
      }

      // Check ask order
      if (tradingPair.askOrder?.id === orderId) {
        if (status === 'CANCELED' || status === 'EXPIRED') {
          // Remove the order since it's no longer active
          tradingPair.askOrder = undefined;
          orderUpdated = true;
          console.log(`[${ticker}] Ask order ${orderId} ${status.toLowerCase()}`);
        } else if (tradingPair.askOrder) {
          // Update the order status
          tradingPair.askOrder.status = status as OrderStatus;
          orderUpdated = true;
        }
      }

      if (orderUpdated) {
        this.tradingPairs.set(ticker, tradingPair);
        break;
      }
    }
  }


  public onSnapshot(callback: SnapshotCallback): void {
    this.snapshotCallback = callback;
  }

  public updatePrice(priceUpdate: PriceUpdate): void {
    this.latestPrices.set(priceUpdate.ticker, priceUpdate);
  }

  public updateTradingPair(tradingPair: TradingPair): void {
    this.tradingPairs.set(tradingPair.ticker, tradingPair);
  }

  public getTradingPair(ticker: string): TradingPair | undefined {
    return this.tradingPairs.get(ticker);
  }

  public start(): void {
    if (this.snapshotTimer) {
      return;
    }

    this.snapshotTimer = setInterval(() => {
      this.takeSnapshot();
    }, this.quoteRefreshCycle);

    console.log(`Price snapshot manager started with ${this.quoteRefreshCycle}ms refresh cycle`);
  }

  public stop(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
      console.log('Price snapshot manager stopped');
    }
  }

  public getLatestSnapshot(ticker: string): PriceSnapshot | undefined {
    const snapshots = this.snapshots[ticker];
    return snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : undefined;
  }

  public getSnapshots(ticker: string, count?: number): PriceSnapshot[] {
    const snapshots = this.snapshots[ticker] || [];
    if (count && count > 0) {
      return snapshots.slice(-count);
    }
    return snapshots;
  }

  public getAllLatestSnapshots(): PriceSnapshot[] {
    return Object.keys(this.snapshots).map(ticker => this.getLatestSnapshot(ticker)).filter((s): s is PriceSnapshot => s !== undefined);
  }

  public getAllActiveOrders(): Array<{ticker: string, orderId: string, side: 'BID' | 'ASK'}> {
    const activeOrders: Array<{ticker: string, orderId: string, side: 'BID' | 'ASK'}> = [];

    for (const [ticker, tradingPair] of this.tradingPairs.entries()) {
      if (tradingPair.bidOrder &&
          (tradingPair.bidOrder.status === 'NEW' || !tradingPair.bidOrder.status) &&
          !tradingPair.bidOrder.id.startsWith('position-')) {
        activeOrders.push({
          ticker,
          orderId: tradingPair.bidOrder.id,
          side: 'BID'
        });
      }

      if (tradingPair.askOrder &&
          (tradingPair.askOrder.status === 'NEW' || !tradingPair.askOrder.status) &&
          !tradingPair.askOrder.id.startsWith('position-')) {
        activeOrders.push({
          ticker,
          orderId: tradingPair.askOrder.id,
          side: 'ASK'
        });
      }
    }

    return activeOrders;
  }

  public async cancelAllActiveOrders(): Promise<void> {
    const activeOrders = this.getAllActiveOrders();

    if (activeOrders.length === 0) {
      console.log('No active orders to cancel');
      return;
    }

    console.log(`Cancelling ${activeOrders.length} active orders...`);

    const subaccount = process.env.ETHEREAL_SUBACCOUNT;
    if (!subaccount) {
      console.error('ETHEREAL_SUBACCOUNT not set, cannot cancel orders');
      return;
    }

    // Clear all concurrency locks during shutdown
    this.orderCreationInProgress.clear();
    this.orderCancellationInProgress.clear();

    try {
      // Cancel all orders in a single request
      const orderIds = activeOrders.map(order => order.orderId);

      const cancelRequest: CancelOrderRequest = {
        order_ids: orderIds,
        subaccount: subaccount
      };

      const response = await this.etherealService!.cancelOrder(cancelRequest);

      // Clear all orders from trading pairs
      for (const [ticker, tradingPair] of this.tradingPairs.entries()) {
        if (tradingPair.bidOrder) {
          tradingPair.bidOrder = undefined;
        }
        if (tradingPair.askOrder) {
          tradingPair.askOrder = undefined;
        }
        this.tradingPairs.set(ticker, tradingPair);
      }

      console.log(`Successfully cancelled ${orderIds.length} orders`);
    } catch (error) {
      console.error('Error cancelling orders during shutdown:', error);
    }
  }

  public async loadExistingPositions(subaccountId: string): Promise<void> {
    if (!this.etherealService) {
      console.error('EtherealService not set, cannot fetch positions');
      return;
    }

    try {
      console.log('Fetching existing positions...');

      // Get productIds from asset configs
      const productIds = Array.from(this.assetConfigs.values())
        .map(config => config.productId)
        .filter((id): id is string => id !== undefined && id.length > 0);

      const positionsResponse = await this.etherealService.getPositions(subaccountId, productIds);

      if (positionsResponse && positionsResponse.data) {
        for (const position of positionsResponse.data) {
          // Find ticker by productId
          const productId = position.productId;
          let ticker = position.productTicker || position.ticker;

          // If no ticker, try to find it by productId
          if (!ticker && productId) {
            const assetConfig = Array.from(this.assetConfigs.values()).find(config => config.productId === productId);
            ticker = assetConfig?.ticker;
          }

          if (!ticker) continue;

          // Get or create trading pair
          const tradingPair: TradingPair = this.tradingPairs.get(ticker) || { ticker };

          // Parse position data
          const quantity = parseFloat(position.quantity || position.size || '0');
          const entryPrice = parseFloat(position.entryPrice || position.avgPrice || '0');

          if (quantity > 0) {
            // Long position = treat as filled bid order
            tradingPair.longPosition = {
              ticker,
              side: 'LONG',
              quantity: Math.abs(quantity),
              entryPrice,
              timestamp: Date.now()
            };

            // Create virtual filled bid order
            tradingPair.bidOrder = {
              id: `position-bid-${productId}`,
              ticker,
              side: 'BID',
              price: entryPrice,
              quantity: Math.abs(quantity),
              quantityFilled: Math.abs(quantity),
              status: 'FILLED',
              timestamp: Date.now()
            };

            console.log(`[${ticker}] Found existing LONG position: ${quantity} @ $${entryPrice} (treating as filled bid)`);
          } else if (quantity < 0) {
            // Short position = treat as filled ask order
            tradingPair.shortPosition = {
              ticker,
              side: 'SHORT',
              quantity: Math.abs(quantity),
              entryPrice,
              timestamp: Date.now()
            };

            // Create virtual filled ask order
            tradingPair.askOrder = {
              id: `position-ask-${productId}`,
              ticker,
              side: 'ASK',
              price: entryPrice,
              quantity: Math.abs(quantity),
              quantityFilled: Math.abs(quantity),
              status: 'FILLED',
              timestamp: Date.now()
            };

            console.log(`[${ticker}] Found existing SHORT position: ${Math.abs(quantity)} @ $${entryPrice} (treating as filled ask)`);
          }

          this.tradingPairs.set(ticker, tradingPair);
        }
      }

      console.log('Finished loading existing positions');
    } catch (error) {
      console.error('Error loading existing positions:', error);
    }
  }

  private takeSnapshot(): void {
    const currentTime = Date.now();
    console.log(`Taking snapshot at ${new Date(currentTime).toISOString()}, ${this.latestPrices.size} price(s) available`);

    this.latestPrices.forEach((priceUpdate, ticker) => {
      const snapshot: PriceSnapshot = {
        ticker,
        price: priceUpdate.price,
        confidence: priceUpdate.confidence,
        timestamp: currentTime
      };

      if (!this.snapshots[ticker]) {
        this.snapshots[ticker] = [];
      }

      this.snapshots[ticker].push(snapshot);

      // Keep only last 100 snapshots per ticker to prevent memory issues
      if (this.snapshots[ticker].length > 100) {
        this.snapshots[ticker] = this.snapshots[ticker].slice(-100);
      }

      // Check orders and positions if deviation check service is available
      if (this.deviationCheckService) {
        this.checkOrdersAndPositions(ticker, priceUpdate.price).catch(error => {
          console.error(`[${ticker}] Error in deviation check:`, error);
        });
      }

      // Check and create orders for market making
      this.checkAndCreateOrders(ticker, priceUpdate.price);

      // Clean up completed trading pairs
      this.cleanupCompletedTradingPairs(ticker);

      // Call snapshot callback AFTER all trading logic completes
      this.snapshotCallback?.(snapshot);
    });
  }

  private async checkOrdersAndPositions(ticker: string, currentPrice: number): Promise<void> {
    if (!this.deviationCheckService || !this.etherealService) return;

    const tradingPair = this.tradingPairs.get(ticker);
    if (!tradingPair) return;

    const assetConfig = this.assetConfigs.get(ticker);
    if (!assetConfig) return;

    const maxDeviation = assetConfig.maxPriceDeviation;

    const marketState = this.deviationCheckService.calculateMarketState(ticker, currentPrice, maxDeviation);
    const checks = this.deviationCheckService.checkOrdersAndPositions(tradingPair, marketState);

    // Cancel orders that have deviated too far
    if (checks.shouldCancelBid && tradingPair.bidOrder) {
      const cancelKey = `${ticker}-bid-${tradingPair.bidOrder.id}`;
      if (!this.orderCancellationInProgress.has(cancelKey)) {
        this.orderCancellationInProgress.add(cancelKey);
        try {
          await this.cancelOrder(ticker, tradingPair.bidOrder.id, 'BID');
        } finally {
          this.orderCancellationInProgress.delete(cancelKey);
        }
      } else {
        console.log(`[${ticker}] Bid order cancellation already in progress`);
      }
    }

    if (checks.shouldCancelAsk && tradingPair.askOrder) {
      const cancelKey = `${ticker}-ask-${tradingPair.askOrder.id}`;
      if (!this.orderCancellationInProgress.has(cancelKey)) {
        this.orderCancellationInProgress.add(cancelKey);
        try {
          await this.cancelOrder(ticker, tradingPair.askOrder.id, 'ASK');
        } finally {
          this.orderCancellationInProgress.delete(cancelKey);
        }
      } else {
        console.log(`[${ticker}] Ask order cancellation already in progress`);
      }
    }
  }

  private async checkAndCreateOrders(ticker: string, currentPrice: number): Promise<void> {
    if (!this.etherealService) return;

    const assetConfig = this.assetConfigs.get(ticker);
    if (!assetConfig) return;

    // Check if order creation is already in progress for this ticker
    if (this.orderCreationInProgress.has(ticker)) {
      console.log(`[${ticker}] Order creation already in progress, skipping`);
      return;
    }

    const tradingPair = this.tradingPairs.get(ticker) || { ticker };

    // Check if we need to create orders
    const needsBidOrder = !tradingPair.bidOrder
    const needsAskOrder = !tradingPair.askOrder;

    if (needsBidOrder || needsAskOrder) {
      // Mark order creation as in progress
      this.orderCreationInProgress.add(ticker);

      try {
        if (needsBidOrder) {
          await this.createBidOrder(ticker, currentPrice, assetConfig);
        }
        if (needsAskOrder) {
          await this.createAskOrder(ticker, currentPrice, assetConfig);
        }
      } catch (error) {
        console.error(`[${ticker}] Error creating orders:`, error);
      } finally {
        // Always remove the lock, even if creation failed
        this.orderCreationInProgress.delete(ticker);
      }
    }
  }

  private async createBidOrder(ticker: string, currentPrice: number, config: AssetConfig): Promise<void> {
    const bidPrice = calculateBidPrice(currentPrice, config.spreadWidth);
    const tickSize = config.tickSize || 1;

    const bidOrder: CreateOrderRequest = {
      order_type: 'LIMIT',
      quantity: config.orderSize,
      side: convertSideToNumber('BUY'),
      price: roundToTickSize(bidPrice, tickSize),
      ticker,
      time_in_force: 'GTD',
      expires_at: generateExpiresAt(5) // 5 minutes
    };

    console.log(`[${ticker}] Creating bid order at $${bidOrder.price} for ${bidOrder.quantity}`);

    const response = await this.etherealService!.placeOrder(bidOrder);

    if (response?.order?.id) {
      // Update trading pair with new bid order
      const tradingPair = this.tradingPairs.get(ticker) || { ticker };
      tradingPair.bidOrder = {
        id: response.order.id,
        ticker,
        side: 'BID',
        price: bidOrder.price!,
        quantity: bidOrder.quantity,
        quantityFilled: 0,
        status: 'NEW',
        timestamp: Date.now()
      };
      this.tradingPairs.set(ticker, tradingPair);
    }
  }

  private async createAskOrder(ticker: string, currentPrice: number, config: AssetConfig): Promise<void> {
    const askPrice = calculateAskPrice(currentPrice, config.spreadWidth);
    const tickSize = config.tickSize || 1;

    const askOrder: CreateOrderRequest = {
      order_type: 'LIMIT',
      quantity: config.orderSize,
      side: convertSideToNumber('SELL'),
      price: roundToTickSize(askPrice, tickSize),
      ticker,
      time_in_force: 'GTD',
      expires_at: generateExpiresAt(5) // 5 minutes
    };

    console.log(`[${ticker}] Creating ask order at $${askOrder.price} for ${askOrder.quantity}`);

    const response = await this.etherealService!.placeOrder(askOrder);

    if (response?.order?.id) {
      const tradingPair = this.tradingPairs.get(ticker) || { ticker };
      tradingPair.askOrder = {
        id: response.order.id,
        ticker,
        side: 'ASK',
        price: askOrder.price!,
        quantity: askOrder.quantity,
        quantityFilled: 0,
        status: 'NEW',
        timestamp: Date.now()
      };
      this.tradingPairs.set(ticker, tradingPair);
    }
  }

  private async cancelOrder(ticker: string, orderId: string, side: 'BID' | 'ASK'): Promise<void> {
    const subaccount = process.env.ETHEREAL_SUBACCOUNT;
    if (!subaccount) {
      console.error('ETHEREAL_SUBACCOUNT not set, cannot cancel order');
      return;
    }

    try {
      const cancelRequest: CancelOrderRequest = {
        order_ids: [orderId],
        subaccount: subaccount
      };

      console.log(`[${ticker}] Cancelling ${side.toLowerCase()} order ${orderId} due to price deviation`);
      await this.etherealService!.cancelOrder(cancelRequest);

      const tradingPair = this.tradingPairs.get(ticker);
      if (tradingPair) {
        if (side === 'BID') {
          tradingPair.bidOrder = undefined;
        } else {
          tradingPair.askOrder = undefined;
        }
        this.tradingPairs.set(ticker, tradingPair);
      }

      console.log(`[${ticker}] Successfully cancelled ${side.toLowerCase()} order ${orderId}`);
    } catch (error) {
      console.error(`[${ticker}] Error cancelling ${side.toLowerCase()} order ${orderId}:`, error);
    }
  }

  private cleanupCompletedTradingPairs(ticker: string): void {
    const tradingPair = this.tradingPairs.get(ticker);
    if (!tradingPair) return;

    // Check if both bid and ask orders are filled
    const bidFilled = tradingPair.bidOrder?.status === 'FILLED';
    const askFilled = tradingPair.askOrder?.status === 'FILLED';

    if (bidFilled && askFilled) {
      // Clear the filled orders to allow new orders to be created
      tradingPair.bidOrder = undefined;
      tradingPair.askOrder = undefined;

      this.tradingPairs.set(ticker, tradingPair);
    }
  }
}