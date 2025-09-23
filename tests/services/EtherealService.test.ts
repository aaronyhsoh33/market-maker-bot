import { EtherealService, EtherealServiceConfig } from '../../src/services/EtherealService';
import { CreateOrderRequest, CancelOrderRequest, OrderResponse } from '../../src/types/orders';

// Mock axios
jest.mock('axios');

describe('EtherealService', () => {
  let service: EtherealService;
  let config: EtherealServiceConfig;
  let mockAxios: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup config
    config = {
      localBaseUrl: 'http://localhost:8080',
      apiBaseUrl: 'https://api.etherealtest.net/v1',
      timeout: 10000
    };

    // Mock axios and its create method
    mockAxios = require('axios');
    const mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn()
    };

    mockAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    service = new EtherealService(config);
  });

  describe('constructor', () => {
    it('should create axios instances with correct configuration', () => {
      expect(mockAxios.create).toHaveBeenCalledTimes(2);

      // Local client configuration
      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: config.localBaseUrl,
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // API client configuration
      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: config.apiBaseUrl,
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should use default timeout when not provided', () => {
      const configWithoutTimeout = {
        localBaseUrl: 'http://localhost:8080',
        apiBaseUrl: 'https://api.etherealtest.net/v1'
      };

      new EtherealService(configWithoutTimeout);

      expect(mockAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 10000 // Default timeout
        })
      );
    });

    it('should use custom timeout when provided', () => {
      const customConfig = {
        localBaseUrl: 'http://localhost:8080',
        apiBaseUrl: 'https://api.etherealtest.net/v1',
        timeout: 5000
      };

      new EtherealService(customConfig);

      expect(mockAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000
        })
      );
    });
  });

  describe('placeOrder', () => {
    let mockLocalClient: any;

    beforeEach(() => {
      mockLocalClient = mockAxios.create();
    });

    it('should place order successfully', async () => {
      const orderRequest: CreateOrderRequest = {
        client_order_id: 'test-order-123',
        ticker: 'BTCUSD',
        side: 0, // BUY
        order_type: 'LIMIT',
        time_in_force: 'GTD',
        price: 50000,
        quantity: 0.001,
        expires_at: Math.floor(Date.now() / 1000) + 300 // 5 minutes
      };

      const expectedResponse: OrderResponse = {
        order_id: 'ethereal-order-456',
        client_order_id: 'test-order-123',
        status: 'NEW',
        filled_quantity: 0,
        remaining_quantity: 0.001,
        created_time: Date.now()
      };

      mockLocalClient.post.mockResolvedValue({ data: expectedResponse });

      const result = await service.placeOrder(orderRequest);

      expect(mockLocalClient.post).toHaveBeenCalledWith('/orders', orderRequest);
      expect(result).toEqual(expectedResponse);
    });

    it('should handle order placement errors', async () => {
      const orderRequest: CreateOrderRequest = {
        client_order_id: 'test-order-123',
        ticker: 'BTCUSD',
        side: 0,
        order_type: 'LIMIT',
        time_in_force: 'GTD',
        price: 50000,
        quantity: 0.001,
        expires_at: Math.floor(Date.now() / 1000) + 300
      };

      const mockError = new Error('Order rejected: Insufficient margin');
      mockLocalClient.post.mockRejectedValue(mockError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.placeOrder(orderRequest)).rejects.toThrow('Order rejected: Insufficient margin');

      expect(consoleSpy).toHaveBeenCalledWith('Error placing order:', mockError);
      expect(mockLocalClient.post).toHaveBeenCalledWith('/orders', orderRequest);

      consoleSpy.mockRestore();
    });

    it('should handle network timeouts', async () => {
      const orderRequest: CreateOrderRequest = {
        client_order_id: 'test-order-123',
        ticker: 'BTCUSD',
        side: 1, // SELL
        order_type: 'LIMIT',
        time_in_force: 'GTD',
        price: 51000,
        quantity: 0.002,
        expires_at: Math.floor(Date.now() / 1000) + 300
      };

      const timeoutError = { code: 'ECONNABORTED', message: 'timeout' };
      mockLocalClient.post.mockRejectedValue(timeoutError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.placeOrder(orderRequest)).rejects.toEqual(timeoutError);

      expect(consoleSpy).toHaveBeenCalledWith('Error placing order:', timeoutError);

      consoleSpy.mockRestore();
    });

    it('should handle different order types and sides', async () => {
      const sellOrderRequest: CreateOrderRequest = {
        client_order_id: 'sell-order-789',
        ticker: 'ETHUSD',
        side: 1, // SELL
        order_type: 'LIMIT',
        time_in_force: 'GTD',
        price: 2500,
        quantity: 0.1,
        expires_at: Math.floor(Date.now() / 1000) + 600 // 10 minutes
      };

      const expectedResponse: OrderResponse = {
        order_id: 'ethereal-sell-456',
        client_order_id: 'sell-order-789',
        status: 'NEW',
        filled_quantity: 0,
        remaining_quantity: 0.1,
        created_time: Date.now()
      };

      mockLocalClient.post.mockResolvedValue({ data: expectedResponse });

      const result = await service.placeOrder(sellOrderRequest);

      expect(result).toEqual(expectedResponse);
      expect(mockLocalClient.post).toHaveBeenCalledWith('/orders', sellOrderRequest);
    });
  });

  describe('cancelOrder', () => {
    let mockLocalClient: any;

    beforeEach(() => {
      mockLocalClient = mockAxios.create();
    });

    it('should cancel single order successfully', async () => {
      const cancelRequest: CancelOrderRequest = {
        order_ids: ['ethereal-order-123'],
        subaccount: 'main'
      };

      const expectedResponse: OrderResponse = {
        order_id: 'ethereal-order-123',
        client_order_id: 'test-order-456',
        status: 'CANCELED',
        filled_quantity: 0,
        remaining_quantity: 0,
        created_time: Date.now()
      };

      mockLocalClient.post.mockResolvedValue({ data: expectedResponse });

      const result = await service.cancelOrder(cancelRequest);

      expect(mockLocalClient.post).toHaveBeenCalledWith('/orders/cancel', cancelRequest);
      expect(result).toEqual(expectedResponse);
    });

    it('should cancel multiple orders successfully', async () => {
      const cancelRequest: CancelOrderRequest = {
        order_ids: ['order-1', 'order-2', 'order-3'],
        subaccount: 'main'
      };

      const expectedResponse: OrderResponse = {
        order_id: 'bulk-cancel-response',
        client_order_id: '',
        status: 'CANCELED',
        filled_quantity: 0,
        remaining_quantity: 0,
        created_time: Date.now()
      };

      mockLocalClient.post.mockResolvedValue({ data: expectedResponse });

      const result = await service.cancelOrder(cancelRequest);

      expect(result).toEqual(expectedResponse);
      expect(mockLocalClient.post).toHaveBeenCalledWith('/orders/cancel', cancelRequest);
    });

    it('should handle cancellation errors', async () => {
      const cancelRequest: CancelOrderRequest = {
        order_ids: ['nonexistent-order'],
        subaccount: 'main'
      };

      const mockError = new Error('Order not found');
      mockLocalClient.post.mockRejectedValue(mockError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.cancelOrder(cancelRequest)).rejects.toThrow('Order not found');

      expect(consoleSpy).toHaveBeenCalledWith('Error cancelling order:', mockError);
      expect(mockLocalClient.post).toHaveBeenCalledWith('/orders/cancel', cancelRequest);

      consoleSpy.mockRestore();
    });

    it('should handle server errors during cancellation', async () => {
      const cancelRequest: CancelOrderRequest = {
        order_ids: ['order-123'],
        subaccount: 'main'
      };

      const serverError = { response: { status: 500, data: 'Internal server error' } };
      mockLocalClient.post.mockRejectedValue(serverError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.cancelOrder(cancelRequest)).rejects.toEqual(serverError);

      expect(consoleSpy).toHaveBeenCalledWith('Error cancelling order:', serverError);

      consoleSpy.mockRestore();
    });

    it('should handle empty order ID array', async () => {
      const cancelRequest: CancelOrderRequest = {
        order_ids: [],
        subaccount: 'main'
      };

      const expectedResponse: OrderResponse = {
        order_id: '',
        client_order_id: '',
        status: 'CANCELED',
        filled_quantity: 0,
        remaining_quantity: 0,
        created_time: Date.now()
      };

      mockLocalClient.post.mockResolvedValue({ data: expectedResponse });

      const result = await service.cancelOrder(cancelRequest);

      expect(result).toEqual(expectedResponse);
      expect(mockLocalClient.post).toHaveBeenCalledWith('/orders/cancel', cancelRequest);
    });
  });

  describe('integration scenarios', () => {
    let mockLocalClient: any;
    let mockApiClient: any;

    beforeEach(() => {
      mockLocalClient = mockAxios.create();
      mockApiClient = mockAxios.create();
    });

    it('should handle order lifecycle: place -> modify -> cancel', async () => {
      // Place order
      const orderRequest: CreateOrderRequest = {
        client_order_id: 'lifecycle-test-001',
        ticker: 'BTCUSD',
        side: 0,
        order_type: 'LIMIT',
        time_in_force: 'GTD',
        price: 50000,
        quantity: 0.001,
        expires_at: Math.floor(Date.now() / 1000) + 300
      };

      const placeResponse: OrderResponse = {
        order_id: 'ethereal-123',
        client_order_id: 'lifecycle-test-001',
        status: 'NEW',
        filled_quantity: 0,
        remaining_quantity: 0.001,
        created_time: Date.now()
      };

      mockLocalClient.post.mockResolvedValueOnce({ data: placeResponse });

      const placedOrder = await service.placeOrder(orderRequest);
      expect(placedOrder.order_id).toBe('ethereal-123');

      // Cancel order
      const cancelRequest: CancelOrderRequest = {
        order_ids: [placedOrder.order_id],
        subaccount: 'main'
      };

      const cancelResponse: OrderResponse = {
        order_id: 'ethereal-123',
        client_order_id: 'lifecycle-test-001',
        status: 'CANCELED',
        filled_quantity: 0,
        remaining_quantity: 0,
        created_time: Date.now()
      };

      mockLocalClient.post.mockResolvedValueOnce({ data: cancelResponse });

      const canceledOrder = await service.cancelOrder(cancelRequest);
      expect(canceledOrder.status).toBe('CANCELED');

      expect(mockLocalClient.post).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent order operations', async () => {
      const order1: CreateOrderRequest = {
        client_order_id: 'concurrent-1',
        ticker: 'BTCUSD',
        side: 0,
        order_type: 'LIMIT',
        time_in_force: 'GTD',
        price: 49000,
        quantity: 0.001,
        expires_at: Math.floor(Date.now() / 1000) + 300
      };

      const order2: CreateOrderRequest = {
        client_order_id: 'concurrent-2',
        ticker: 'BTCUSD',
        side: 1,
        order_type: 'LIMIT',
        time_in_force: 'GTD',
        price: 51000,
        quantity: 0.001,
        expires_at: Math.floor(Date.now() / 1000) + 300
      };

      const response1: OrderResponse = {
        order_id: 'order-1',
        client_order_id: 'concurrent-1',
        status: 'NEW',
        filled_quantity: 0,
        remaining_quantity: 0.001,
        created_time: Date.now()
      };

      const response2: OrderResponse = {
        order_id: 'order-2',
        client_order_id: 'concurrent-2',
        status: 'NEW',
        filled_quantity: 0,
        remaining_quantity: 0.001,
        created_time: Date.now()
      };

      mockLocalClient.post
        .mockResolvedValueOnce({ data: response1 })
        .mockResolvedValueOnce({ data: response2 });

      // Execute concurrent orders
      const [result1, result2] = await Promise.all([
        service.placeOrder(order1),
        service.placeOrder(order2)
      ]);

      expect(result1.client_order_id).toBe('concurrent-1');
      expect(result2.client_order_id).toBe('concurrent-2');
      expect(mockLocalClient.post).toHaveBeenCalledTimes(2);
    });
  });


  describe('getPositions', () => {
    let mockApiClient: any;

    beforeEach(() => {
      mockApiClient = mockAxios.create();
    });

    it('should fetch positions for subaccount without product filter', async () => {
      const mockPositions = {
        data: [
          {
            subaccountId: 'main',
            productId: 'BTCUSD_PERP',
            side: 'LONG',
            quantity: '0.001',
            entryPrice: '50000',
            markPrice: '50100',
            pnl: '0.1'
          },
          {
            subaccountId: 'main',
            productId: 'ETHUSD_PERP',
            side: 'SHORT',
            quantity: '0.01',
            entryPrice: '2500',
            markPrice: '2490',
            pnl: '0.1'
          }
        ]
      };

      mockApiClient.get.mockResolvedValue({ data: mockPositions });

      const result = await service.getPositions('main');

      expect(result).toEqual(mockPositions);
      expect(mockApiClient.get).toHaveBeenCalledWith('/position?subaccountId=main&open=true');
    });

    it('should fetch positions with single product filter', async () => {
      const mockPositions = {
        data: [
          {
            subaccountId: 'main',
            productId: 'BTCUSD_PERP',
            side: 'LONG',
            quantity: '0.001',
            entryPrice: '50000',
            markPrice: '50100',
            pnl: '0.1'
          }
        ]
      };

      mockApiClient.get.mockResolvedValue({ data: mockPositions });

      const result = await service.getPositions('main', ['BTCUSD_PERP']);

      expect(result).toEqual(mockPositions);
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/position?subaccountId=main&open=true&productIds=BTCUSD_PERP'
      );
    });

    it('should fetch positions with multiple product filters', async () => {
      const mockPositions = {
        data: [
          {
            subaccountId: 'trading',
            productId: 'BTCUSD_PERP',
            side: 'LONG',
            quantity: '0.001',
            entryPrice: '50000'
          },
          {
            subaccountId: 'trading',
            productId: 'ETHUSD_PERP',
            side: 'SHORT',
            quantity: '0.01',
            entryPrice: '2500'
          }
        ]
      };

      mockApiClient.get.mockResolvedValue({ data: mockPositions });

      const result = await service.getPositions('trading', ['BTCUSD_PERP', 'ETHUSD_PERP']);

      expect(result).toEqual(mockPositions);
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/position?subaccountId=trading&open=true&productIds=BTCUSD_PERP&productIds=ETHUSD_PERP'
      );
    });

    it('should handle empty product array same as no filter', async () => {
      const mockPositions = { data: [] };
      mockApiClient.get.mockResolvedValue({ data: mockPositions });

      const result = await service.getPositions('main', []);

      expect(result).toEqual(mockPositions);
      expect(mockApiClient.get).toHaveBeenCalledWith('/position?subaccountId=main&open=true');
    });

    it('should handle position fetch errors', async () => {
      const mockError = new Error('Positions API unavailable');
      mockApiClient.get.mockRejectedValue(mockError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.getPositions('main')).rejects.toThrow('Positions API unavailable');

      expect(consoleSpy).toHaveBeenCalledWith('Error fetching positions:', mockError);
      expect(mockApiClient.get).toHaveBeenCalledWith('/position?subaccountId=main&open=true');

      consoleSpy.mockRestore();
    });

    it('should handle 404 for non-existent subaccount', async () => {
      const notFoundError = { response: { status: 404, data: 'Subaccount not found' } };
      mockApiClient.get.mockRejectedValue(notFoundError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.getPositions('nonexistent')).rejects.toEqual(notFoundError);

      expect(consoleSpy).toHaveBeenCalledWith('Error fetching positions:', notFoundError);

      consoleSpy.mockRestore();
    });

    it('should handle authorization errors', async () => {
      const authError = { response: { status: 401, data: 'Unauthorized' } };
      mockApiClient.get.mockRejectedValue(authError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.getPositions('main')).rejects.toEqual(authError);

      consoleSpy.mockRestore();
    });

    it('should handle network timeouts', async () => {
      const timeoutError = { code: 'ECONNABORTED', message: 'timeout' };
      mockApiClient.get.mockRejectedValue(timeoutError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.getPositions('main')).rejects.toEqual(timeoutError);

      consoleSpy.mockRestore();
    });
  });

});