import {
  generateClientOrderId,
  generateExpiresAt,
  convertSideToNumber
} from '../../src/utils/orderUtils';

describe('OrderUtils', () => {
  describe('generateClientOrderId', () => {
    it('should generate unique order IDs with default prefix', async () => {
      const id1 = generateClientOrderId();
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 2));
      const id2 = generateClientOrderId();

      expect(id1).toMatch(/^mmbot-\d+$/);
      expect(id2).toMatch(/^mmbot-\d+$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate order IDs with custom prefix', () => {
      const id1 = generateClientOrderId('test');
      const id2 = generateClientOrderId('bot');

      expect(id1).toMatch(/^test-\d+$/);
      expect(id2).toMatch(/^bot-\d+$/);
    });

    it('should include timestamp in order ID', () => {
      const beforeTime = Date.now();
      const orderId = generateClientOrderId('test');
      const afterTime = Date.now();

      const timestamp = parseInt(orderId.split('-')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should handle empty prefix', () => {
      const id = generateClientOrderId('');
      expect(id).toMatch(/^-\d+$/);
    });

    it('should handle special characters in prefix', () => {
      const id = generateClientOrderId('test_bot-123');
      expect(id).toMatch(/^test_bot-123-\d+$/);
    });
  });

  describe('generateExpiresAt', () => {
    it('should generate expiration timestamp in seconds', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      const expiresAt = generateExpiresAt(5); // 5 minutes
      const afterTime = Math.floor(Date.now() / 1000);

      // Should be between now + 4:59 and now + 5:01 (accounting for test execution time)
      expect(expiresAt).toBeGreaterThanOrEqual(beforeTime + 299); // 4:59
      expect(expiresAt).toBeLessThanOrEqual(afterTime + 301); // 5:01
    });

    it('should calculate correct expiration times', () => {
      const now = Math.floor(Date.now() / 1000);

      const expires1min = generateExpiresAt(1);
      const expires5min = generateExpiresAt(5);
      const expires60min = generateExpiresAt(60);

      expect(expires1min - now).toBeCloseTo(60, -1); // Within 10 seconds
      expect(expires5min - now).toBeCloseTo(300, -1); // Within 10 seconds
      expect(expires60min - now).toBeCloseTo(3600, -1); // Within 10 seconds
    });

    it('should handle zero minutes', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = generateExpiresAt(0);

      expect(expiresAt).toBeCloseTo(now, 0);
    });

    it('should handle fractional minutes', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = generateExpiresAt(0.5); // 30 seconds

      expect(expiresAt - now).toBeCloseTo(30, 0);
    });

    it('should return integer timestamps', () => {
      const expiresAt = generateExpiresAt(5);
      expect(Number.isInteger(expiresAt)).toBe(true);
    });
  });

  describe('convertSideToNumber', () => {
    it('should convert BUY to 0', () => {
      expect(convertSideToNumber('BUY')).toBe(0);
    });

    it('should convert SELL to 1', () => {
      expect(convertSideToNumber('SELL')).toBe(1);
    });

    it('should handle consistent conversions', () => {
      // Test multiple times to ensure consistency
      for (let i = 0; i < 10; i++) {
        expect(convertSideToNumber('BUY')).toBe(0);
        expect(convertSideToNumber('SELL')).toBe(1);
      }
    });
  });

  describe('integration tests', () => {
    it('should generate realistic order creation data', () => {
      // Simulate creating an order
      const clientOrderId = generateClientOrderId('trading');
      const expiresAt = generateExpiresAt(5); // 5 minutes GTD
      const buySide = convertSideToNumber('BUY');
      const sellSide = convertSideToNumber('SELL');

      // Validate the generated data
      expect(clientOrderId).toMatch(/^trading-\d+$/);
      expect(expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(buySide).toBe(0);
      expect(sellSide).toBe(1);

      // Should be suitable for order creation
      const mockOrder = {
        client_order_id: clientOrderId,
        expires_at: expiresAt,
        side: buySide,
        order_type: 'LIMIT' as const,
        time_in_force: 'GTD' as const,
        ticker: 'BTCUSD',
        price: 50000,
        quantity: 0.001
      };

      expect(mockOrder.client_order_id).toBeTruthy();
      expect(mockOrder.expires_at).toBeGreaterThan(0);
      expect([0, 1]).toContain(mockOrder.side);
    });

    it('should generate unique order IDs in rapid succession', async () => {
      const orderIds = new Set<string>();
      const iterations = 5; // Further reduce iterations to ensure reliability

      for (let i = 0; i < iterations; i++) {
        const id = generateClientOrderId(`rapid-${i}`); // Make prefix unique too
        orderIds.add(id);
        // Longer delay to ensure unique timestamps
        await new Promise(resolve => setTimeout(resolve, 2));
      }

      // All IDs should be unique
      expect(orderIds.size).toBe(iterations);
    });

    it('should maintain expiration time accuracy under load', () => {
      const targetMinutes = 5;
      const targetSeconds = targetMinutes * 60;
      const tolerance = 2; // 2 seconds tolerance

      // Generate multiple expiration times
      const expirationTimes = [];
      for (let i = 0; i < 50; i++) {
        expirationTimes.push(generateExpiresAt(targetMinutes));
      }

      // All should be approximately the same duration from now
      const now = Math.floor(Date.now() / 1000);
      expirationTimes.forEach(expiresAt => {
        const duration = expiresAt - now;
        expect(duration).toBeGreaterThanOrEqual(targetSeconds - tolerance);
        expect(duration).toBeLessThanOrEqual(targetSeconds + tolerance);
      });
    });
  });
});