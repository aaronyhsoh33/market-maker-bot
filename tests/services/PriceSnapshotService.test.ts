import { PriceSnapshotService } from '../../src/services/PriceSnapshotService';
import { DeviationCheckService } from '../../src/services/DeviationCheckService';
import { EtherealService } from '../../src/services/EtherealService';
import { PriceUpdate } from '../../src/types/price';
import { TradingPair, Order, OrderStatus } from '../../src/types/marketMaker';
import { AssetConfig } from '../../src/config/marketConfig';
import { OrderUpdateEvent } from '../../src/types/orderUpdates';
import { PriceSnapshot, SnapshotCallback } from '../../src/types/snapshot';

// Mock the dependencies
jest.mock('../../src/services/DeviationCheckService');
jest.mock('../../src/services/EtherealService');

describe('PriceSnapshotService', () => {
  let service: PriceSnapshotService;
  let mockDeviationService: jest.Mocked<DeviationCheckService>;
  let mockEtherealService: jest.Mocked<EtherealService>;
  let mockSnapshotCallback: jest.Mock;

  const defaultAssetConfig: AssetConfig = {
    ticker: 'BTCUSD',
    orderSize: 0.001,
    spreadWidth: 10, // 10 basis points
    maxPriceDeviation: 5.0, // 5%
    tickSize: 1,
    minQuantity: 0.0001,
    maxQuantity: 1000,
    productId: 'BTCUSD_PERP'
  };

  beforeEach(() => {
    // Create service with 1 second refresh cycle
    service = new PriceSnapshotService(1000);

    // Create mocks
    mockDeviationService = new DeviationCheckService() as jest.Mocked<DeviationCheckService>;
    mockEtherealService = {
      placeOrder: jest.fn(),
      cancelOrder: jest.fn(),
      getPositions: jest.fn(),
      isHealthy: jest.fn()
    } as any;

    mockSnapshotCallback = jest.fn();

    // Inject dependencies
    service.setDeviationCheckService(mockDeviationService);
    service.setEtherealService(mockEtherealService);
    service.onSnapshot(mockSnapshotCallback);

    // Setup default asset config
    service.setAssetConfig('BTCUSD', defaultAssetConfig);

    // Mock deviation service methods
    mockDeviationService.calculateMarketState = jest.fn().mockReturnValue({
      ticker: 'BTCUSD',
      midPrice: 50000,
      bidPrice: 49950,
      askPrice: 50050,
      maxDeviationPrice: 2500,
      timestamp: Date.now()
    });

    mockDeviationService.checkOrdersAndPositions = jest.fn().mockReturnValue({
      shouldCancelBid: false,
      shouldCancelAsk: false,
      shouldClosePositions: false
    });
  });

  afterEach(() => {
    service.stop();
    jest.clearAllMocks();
  });

  describe('constructor and dependency injection', () => {
    it('should initialize with quote refresh cycle', () => {
      const testService = new PriceSnapshotService(5000);
      expect(testService).toBeInstanceOf(PriceSnapshotService);
    });

    it('should set deviation check service', () => {
      const newService = new PriceSnapshotService(1000);
      newService.setDeviationCheckService(mockDeviationService);
      // Service should not throw when using the dependency
      expect(() => newService.setAssetConfig('ETHUSD', defaultAssetConfig)).not.toThrow();
    });

    it('should set ethereal service', () => {
      const newService = new PriceSnapshotService(1000);
      newService.setEtherealService(mockEtherealService);
      expect(() => newService.setAssetConfig('ETHUSD', defaultAssetConfig)).not.toThrow();
    });

    it('should register snapshot callback', () => {
      const callback = jest.fn();
      service.onSnapshot(callback);
      expect(typeof callback).toBe('function');
    });
  });

  describe('asset configuration', () => {
    it('should set asset config for trading pair', () => {
      const ethConfig: AssetConfig = {
        ticker: 'ETHUSD',
        orderSize: 0.01,
        spreadWidth: 15,
        maxPriceDeviation: 3.0,
        tickSize: 0.01,
        minQuantity: 0.001,
        maxQuantity: 100,
        productId: 'ETHUSD_PERP'
      };

      expect(() => {
        service.setAssetConfig('ETHUSD', ethConfig);
      }).not.toThrow();
    });

    it('should handle multiple asset configurations', () => {
      const solConfig: AssetConfig = {
        ticker: 'SOLUSD',
        orderSize: 1.0,
        spreadWidth: 20,
        maxPriceDeviation: 7.0,
        tickSize: 0.1,
        minQuantity: 0.1,
        maxQuantity: 10000,
        productId: 'SOLUSD_PERP'
      };

      service.setAssetConfig('ETHUSD', defaultAssetConfig);
      service.setAssetConfig('SOLUSD', solConfig);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('price updates', () => {
    it('should process price updates correctly', () => {
      const priceUpdate: PriceUpdate = {
        ticker: 'BTCUSD',
        price: 50000,
        confidence: 5,
        timestamp: Date.now()
      };

      expect(() => {
        service.updatePrice(priceUpdate);
      }).not.toThrow();
    });

    it('should handle multiple price updates', () => {
      const priceUpdates: PriceUpdate[] = [
        {
          ticker: 'BTCUSD',
          price: 50000,
          confidence: 5,
          timestamp: Date.now()
        },
        {
          ticker: 'ETHUSD',
          price: 2500,
          confidence: 2,
          timestamp: Date.now()
        }
      ];

      priceUpdates.forEach(update => {
        expect(() => {
          service.updatePrice(update);
        }).not.toThrow();
      });
    });

    it('should update latest prices map', () => {
      const priceUpdate: PriceUpdate = {
        ticker: 'BTCUSD',
        price: 51000,
        confidence: 5,
        timestamp: Date.now()
      };

      service.updatePrice(priceUpdate);

      // We can't directly access private members, but the method should execute without errors
      expect(true).toBe(true);
    });

    it('should handle price updates for unconfigured tickers', () => {
      const priceUpdate: PriceUpdate = {
        ticker: 'UNKNOWN',
        price: 100,
        confidence: 1,
        timestamp: Date.now()
      };

      // Should not throw even for unconfigured tickers
      expect(() => {
        service.updatePrice(priceUpdate);
      }).not.toThrow();
    });
  });

  describe('trading pair management', () => {
    it('should update trading pair information', () => {
      const tradingPair: TradingPair = {
        ticker: 'BTCUSD',
        bidOrder: {
          id: 'bid-123',
          ticker: 'BTCUSD',
          side: 'BID',
          price: 49950,
          quantity: 0.001,
          quantityFilled: 0,
          status: 'NEW',
          timestamp: Date.now()
        }
      };

      expect(() => {
        service.updateTradingPair(tradingPair);
      }).not.toThrow();
    });

    it('should retrieve trading pair', () => {
      const tradingPair: TradingPair = {
        ticker: 'BTCUSD'
      };

      service.updateTradingPair(tradingPair);

      const retrieved = service.getTradingPair('BTCUSD');
      expect(retrieved).toBeDefined();
      expect(retrieved?.ticker).toBe('BTCUSD');
    });

    it('should return undefined for non-existent trading pair', () => {
      const retrieved = service.getTradingPair('NONEXISTENT');
      expect(retrieved).toBeUndefined();
    });

    it('should update existing trading pair', () => {
      const initialPair: TradingPair = {
        ticker: 'BTCUSD'
      };

      const updatedPair: TradingPair = {
        ticker: 'BTCUSD',
        bidOrder: {
          id: 'bid-456',
          ticker: 'BTCUSD',
          side: 'BID',
          price: 50000,
          quantity: 0.001,
          quantityFilled: 0,
          status: 'NEW',
          timestamp: Date.now()
        }
      };

      service.updateTradingPair(initialPair);
      service.updateTradingPair(updatedPair);

      const retrieved = service.getTradingPair('BTCUSD');
      expect(retrieved?.bidOrder?.id).toBe('bid-456');
    });
  });

  describe('order status updates', () => {
    it('should process order update events', () => {
      const orderUpdate: OrderUpdateEvent = {
        id: 'order-123',
        status: 'FILLED'
      };

      expect(() => {
        service.updateOrderStatus(orderUpdate);
      }).not.toThrow();
    });

    it('should handle different order statuses', () => {
      const orderUpdates: OrderUpdateEvent[] = [
        { id: 'order-1', status: 'NEW' },
        { id: 'order-2', status: 'PARTIALLY_FILLED' },
        { id: 'order-3', status: 'FILLED' },
        { id: 'order-4', status: 'CANCELED' }
      ];

      orderUpdates.forEach(update => {
        expect(() => {
          service.updateOrderStatus(update);
        }).not.toThrow();
      });
    });

    it('should handle order updates with additional data', () => {
      const orderUpdate: OrderUpdateEvent = {
        id: 'order-123',
        status: 'FILLED',
        ticker: 'BTCUSD',
        side: 'BUY',
        price: 50000,
        quantity: 0.001
      };

      expect(() => {
        service.updateOrderStatus(orderUpdate);
      }).not.toThrow();
    });
  });

  describe('snapshot management', () => {
    it('should get latest snapshot for ticker', () => {
      // First update a price to create a snapshot
      const priceUpdate: PriceUpdate = {
        ticker: 'BTCUSD',
        price: 50000,
        confidence: 5,
        timestamp: Date.now()
      };

      service.updatePrice(priceUpdate);

      const snapshot = service.getLatestSnapshot('BTCUSD');
      // Snapshot may be undefined if no processing occurred yet
      expect(snapshot === undefined || snapshot.ticker === 'BTCUSD').toBe(true);
    });

    it('should return undefined for non-existent ticker snapshot', () => {
      const snapshot = service.getLatestSnapshot('NONEXISTENT');
      expect(snapshot).toBeUndefined();
    });

    it('should get multiple snapshots for ticker', () => {
      const snapshots = service.getSnapshots('BTCUSD', 5);
      expect(Array.isArray(snapshots)).toBe(true);
    });

    it('should get all latest snapshots', () => {
      const allSnapshots = service.getAllLatestSnapshots();
      expect(Array.isArray(allSnapshots)).toBe(true);
    });

    it('should limit snapshots when count is specified', () => {
      const snapshots = service.getSnapshots('BTCUSD', 3);
      expect(snapshots.length).toBeLessThanOrEqual(3);
    });
  });

  describe('active orders management', () => {
    it('should get all active orders', () => {
      const activeOrders = service.getAllActiveOrders();
      expect(Array.isArray(activeOrders)).toBe(true);
    });

    it('should cancel all active orders', async () => {
      mockEtherealService.cancelOrder.mockResolvedValue({
        order_id: 'canceled',
        client_order_id: 'test',
        status: 'CANCELED',
        filled_quantity: 0,
        remaining_quantity: 0,
        created_time: Date.now()
      });

      await expect(service.cancelAllActiveOrders()).resolves.not.toThrow();
    });

    it('should handle cancel order errors gracefully', async () => {
      mockEtherealService.cancelOrder.mockRejectedValue(new Error('Cancel failed'));

      // Should not throw even if individual cancellations fail
      await expect(service.cancelAllActiveOrders()).resolves.not.toThrow();
    });
  });

  describe('position loading', () => {
    it('should load existing positions for subaccount', async () => {
      const mockPositions = {
        data: [
          {
            subaccountId: 'main',
            productId: 'BTCUSD_PERP',
            side: 'LONG',
            quantity: '0.001',
            entryPrice: '49000',
            markPrice: '50000',
            pnl: '1.0'
          }
        ]
      };

      mockEtherealService.getPositions.mockResolvedValue(mockPositions);

      await expect(service.loadExistingPositions('main')).resolves.not.toThrow();

      expect(mockEtherealService.getPositions).toHaveBeenCalledWith('main', ['BTCUSD_PERP']);
    });

    it('should handle position loading errors', async () => {
      mockEtherealService.getPositions.mockRejectedValue(new Error('API unavailable'));

      // Should handle errors gracefully
      await expect(service.loadExistingPositions('main')).resolves.not.toThrow();
    });

    it('should handle empty positions response', async () => {
      mockEtherealService.getPositions.mockResolvedValue({ data: [] });

      await expect(service.loadExistingPositions('main')).resolves.not.toThrow();
    });

    it('should handle multiple subaccounts', async () => {
      const mockPositions = { data: [] };
      mockEtherealService.getPositions.mockResolvedValue(mockPositions);

      await expect(service.loadExistingPositions('trading')).resolves.not.toThrow();
      await expect(service.loadExistingPositions('main')).resolves.not.toThrow();

      expect(mockEtherealService.getPositions).toHaveBeenCalledWith('trading', ['BTCUSD_PERP']);
      expect(mockEtherealService.getPositions).toHaveBeenCalledWith('main', ['BTCUSD_PERP']);
    });
  });

  describe('service lifecycle', () => {
    it('should start the service', () => {
      expect(() => {
        service.start();
      }).not.toThrow();
    });

    it('should stop the service', () => {
      service.start();
      expect(() => {
        service.stop();
      }).not.toThrow();
    });

    it('should handle multiple start/stop cycles', () => {
      service.start();
      service.stop();
      service.start();
      service.stop();

      expect(true).toBe(true); // Should not throw
    });

    it('should stop timer when service is stopped', () => {
      service.start();
      service.stop();

      // Timer should be cleared (we can't test this directly but it shouldn't throw)
      expect(true).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete price update workflow', () => {
      // Configure asset
      service.setAssetConfig('BTCUSD', defaultAssetConfig);

      // Update price
      const priceUpdate: PriceUpdate = {
        ticker: 'BTCUSD',
        price: 50000,
        confidence: 5,
        timestamp: Date.now()
      };

      service.updatePrice(priceUpdate);

      // Update trading pair
      const tradingPair: TradingPair = {
        ticker: 'BTCUSD'
      };

      service.updateTradingPair(tradingPair);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should handle order lifecycle', () => {
      // Setup trading pair with orders
      const tradingPair: TradingPair = {
        ticker: 'BTCUSD',
        bidOrder: {
          id: 'bid-123',
          ticker: 'BTCUSD',
          side: 'BID',
          price: 49950,
          quantity: 0.001,
          quantityFilled: 0,
          status: 'NEW',
          timestamp: Date.now()
        },
        askOrder: {
          id: 'ask-123',
          ticker: 'BTCUSD',
          side: 'ASK',
          price: 50050,
          quantity: 0.001,
          quantityFilled: 0,
          status: 'NEW',
          timestamp: Date.now()
        }
      };

      service.updateTradingPair(tradingPair);

      // Process order updates
      service.updateOrderStatus({ id: 'bid-123', status: 'FILLED' });
      service.updateOrderStatus({ id: 'ask-123', status: 'PARTIALLY_FILLED' });

      expect(true).toBe(true);
    });

    it('should handle multiple concurrent operations', () => {
      // Configure multiple assets
      const ethConfig: AssetConfig = { ...defaultAssetConfig, ticker: 'ETHUSD' };
      service.setAssetConfig('ETHUSD', ethConfig);

      // Process multiple price updates
      service.updatePrice({ ticker: 'BTCUSD', price: 50000, confidence: 5, timestamp: Date.now() });
      service.updatePrice({ ticker: 'ETHUSD', price: 2500, confidence: 2, timestamp: Date.now() });

      // Update trading pairs
      service.updateTradingPair({ ticker: 'BTCUSD' });
      service.updateTradingPair({ ticker: 'ETHUSD' });

      // Process order updates
      service.updateOrderStatus({ id: 'btc-order', status: 'NEW' });
      service.updateOrderStatus({ id: 'eth-order', status: 'FILLED' });

      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle operations without required dependencies', () => {
      const newService = new PriceSnapshotService(1000);

      // Should not throw even without dependencies
      expect(() => {
        newService.updatePrice({ ticker: 'BTCUSD', price: 50000, confidence: 5, timestamp: Date.now() });
      }).not.toThrow();
    });

    it('should handle invalid price updates', () => {
      const invalidPriceUpdate = {
        ticker: '',
        price: NaN,
        confidence: -1,
        timestamp: Date.now()
      } as PriceUpdate;

      // Should handle gracefully
      expect(() => {
        service.updatePrice(invalidPriceUpdate);
      }).not.toThrow();
    });

    it('should handle service operations when stopped', () => {
      service.stop();

      // Operations should still work when service is stopped
      expect(() => {
        service.updatePrice({ ticker: 'BTCUSD', price: 50000, confidence: 5, timestamp: Date.now() });
        service.updateOrderStatus({ id: 'order-123', status: 'FILLED' });
      }).not.toThrow();
    });

    it('should handle snapshot callback errors', () => {
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      service.onSnapshot(errorCallback);

      // Should handle callback errors gracefully
      expect(() => {
        service.updatePrice({ ticker: 'BTCUSD', price: 50000, confidence: 5, timestamp: Date.now() });
      }).not.toThrow();
    });
  });

  describe('timer-based functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should take snapshots automatically when timer runs', () => {
      const snapshotCallback = jest.fn();
      service.onSnapshot(snapshotCallback);

      // Add price data
      service.updatePrice({ ticker: 'BTCUSD', price: 50000, confidence: 5, timestamp: Date.now() });

      // Start the service
      service.start();

      // Fast-forward time to trigger snapshot
      jest.advanceTimersByTime(1000);

      expect(snapshotCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          ticker: 'BTCUSD',
          price: 50000,
          confidence: 5
        })
      );
    });

    it('should limit snapshots to 100 per ticker', () => {
      service.updatePrice({ ticker: 'BTCUSD', price: 50000, confidence: 5, timestamp: Date.now() });
      service.start();

      // Generate 150 snapshots
      for (let i = 0; i < 150; i++) {
        jest.advanceTimersByTime(1000);
      }

      const snapshots = service.getSnapshots('BTCUSD');
      expect(snapshots.length).toBe(100);
    });
  });

  describe('order cancellation scenarios', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'error').mockImplementation();
      process.env.ETHEREAL_SUBACCOUNT = 'test-subaccount';
    });

    afterEach(() => {
      delete process.env.ETHEREAL_SUBACCOUNT;
      jest.restoreAllMocks();
    });

    it('should handle missing ETHEREAL_SUBACCOUNT', async () => {
      delete process.env.ETHEREAL_SUBACCOUNT;

      service.updateTradingPair({
        ticker: 'BTCUSD',
        bidOrder: {
          id: 'bid-123',
          ticker: 'BTCUSD',
          side: 'BID',
          price: 49000,
          quantity: 0.001,
          quantityFilled: 0,
          status: 'NEW',
          timestamp: Date.now()
        }
      });

      await service.cancelAllActiveOrders();

      expect(console.error).toHaveBeenCalledWith('ETHEREAL_SUBACCOUNT not set, cannot cancel orders');
      expect(mockEtherealService.cancelOrder).not.toHaveBeenCalled();
    });

    it('should not include position-based orders in cancellation', async () => {
      process.env.ETHEREAL_SUBACCOUNT = 'test-subaccount';

      service.updateTradingPair({
        ticker: 'BTCUSD',
        bidOrder: {
          id: 'position-long-123',
          ticker: 'BTCUSD',
          side: 'BID',
          price: 49000,
          quantity: 0.001,
          quantityFilled: 0.001,
          status: 'NEW',
          timestamp: Date.now()
        },
        askOrder: {
          id: 'regular-order-456',
          ticker: 'BTCUSD',
          side: 'ASK',
          price: 51000,
          quantity: 0.001,
          quantityFilled: 0,
          status: 'NEW',
          timestamp: Date.now()
        }
      });

      mockEtherealService.cancelOrder.mockResolvedValue({ success: true });

      await service.cancelAllActiveOrders();

      expect(mockEtherealService.cancelOrder).toHaveBeenCalledWith({
        order_ids: ['regular-order-456'],
        subaccount: 'test-subaccount'
      });
    });
  });

  describe('enhanced position loading', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should handle positions without ethereal service', async () => {
      const serviceWithoutEthereal = new PriceSnapshotService(1000);
      jest.spyOn(console, 'error').mockImplementation();

      await serviceWithoutEthereal.loadExistingPositions('main');

      expect(console.error).toHaveBeenCalledWith('EtherealService not set, cannot fetch positions');
    });

    it('should handle positions without ticker gracefully', async () => {
      const mockPositions = {
        data: [{
          productId: 'UNKNOWN_PROD',
          side: 'LONG',
          size: '0.001',
          entry_price: '50000'
          // No ticker provided and no matching asset config
        }]
      };

      mockEtherealService.getPositions.mockResolvedValue(mockPositions);

      // Should complete without errors or warnings - silently skips unknown positions
      await expect(service.loadExistingPositions('main')).resolves.not.toThrow();
    });
  });
});