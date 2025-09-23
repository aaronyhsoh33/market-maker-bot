import { loadConfig, loadEtherealConfig, fetchProductInfo } from '../../src/config/marketConfig';

// Mock axios for API testing
jest.mock('axios');

describe('MarketConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load default configuration', () => {
      // Clear relevant env vars to test defaults
      delete process.env.TICKERS;
      delete process.env.QUOTE_REFRESH_CYCLE;
      delete process.env.SPREAD_WIDTH;
      delete process.env.MAX_PRICE_DEVIATION;

      const config = loadConfig();

      expect(config.quoteRefreshCycle).toBe(5000); // Default 5 seconds
      expect(config.assets).toHaveLength(3); // Default BTC, ETH, SOL
      expect(config.assets[0].ticker).toBe('BTCUSD');
      expect(config.assets[1].ticker).toBe('ETHUSD');
      expect(config.assets[2].ticker).toBe('SOLUSD');
    });

    it('should parse TICKERS environment variable', () => {
      process.env.TICKERS = 'BTCUSD,ETHUSD';

      const config = loadConfig();

      expect(config.assets).toHaveLength(2);
      expect(config.assets[0].ticker).toBe('BTCUSD');
      expect(config.assets[1].ticker).toBe('ETHUSD');
    });

    it('should parse QUOTE_REFRESH_CYCLE', () => {
      process.env.QUOTE_REFRESH_CYCLE = '1000';

      const config = loadConfig();

      expect(config.quoteRefreshCycle).toBe(1000);
    });

    it('should use global defaults for asset configuration', () => {
      process.env.TICKERS = 'BTCUSD';
      process.env.SPREAD_WIDTH = '15';
      process.env.MAX_PRICE_DEVIATION = '3.0';

      const config = loadConfig();

      expect(config.assets[0].spreadWidth).toBe(15);
      expect(config.assets[0].maxPriceDeviation).toBe(3.0);
      expect(config.assets[0].orderSize).toBe(100); // Default fallback
    });

    it('should override global defaults with asset-specific values', () => {
      process.env.TICKERS = 'BTCUSD,ETHUSD';
      process.env.SPREAD_WIDTH = '10'; // Global default
      process.env.MAX_PRICE_DEVIATION = '5.0'; // Global default
      process.env.BTC_USD_SPREAD_WIDTH = '5'; // BTC override
      process.env.BTC_USD_ORDER_SIZE = '0.001'; // BTC override
      process.env.ETH_USD_MAX_PRICE_DEVIATION = '2.5'; // ETH override

      const config = loadConfig();

      // BTC should use overrides for spread and order size, global for deviation
      expect(config.assets[0].ticker).toBe('BTCUSD');
      expect(config.assets[0].spreadWidth).toBe(5); // Override
      expect(config.assets[0].orderSize).toBe(0.001); // Override
      expect(config.assets[0].maxPriceDeviation).toBe(5.0); // Global

      // ETH should use override for deviation, global for others
      expect(config.assets[1].ticker).toBe('ETHUSD');
      expect(config.assets[1].spreadWidth).toBe(10); // Global
      expect(config.assets[1].orderSize).toBe(100); // Default
      expect(config.assets[1].maxPriceDeviation).toBe(2.5); // Override
    });

    it('should handle single ticker configuration', () => {
      process.env.TICKERS = 'BTCUSD';
      process.env.BTC_USD_ORDER_SIZE = '0.01';

      const config = loadConfig();

      expect(config.assets).toHaveLength(1);
      expect(config.assets[0].ticker).toBe('BTCUSD');
      expect(config.assets[0].orderSize).toBe(0.01);
    });

    it('should handle complex ticker configuration', () => {
      process.env.TICKERS = 'BTCUSD,ETHUSD,SOLUSD,AVAXUSD';

      const config = loadConfig();

      expect(config.assets).toHaveLength(4);
      expect(config.assets.map(a => a.ticker)).toEqual(['BTCUSD', 'ETHUSD', 'SOLUSD', 'AVAXUSD']);
    });

    it('should parse numeric values correctly', () => {
      process.env.TICKERS = 'BTCUSD';
      process.env.QUOTE_REFRESH_CYCLE = '500';
      process.env.BTC_USD_ORDER_SIZE = '0.005';
      process.env.BTC_USD_SPREAD_WIDTH = '7.5';
      process.env.BTC_USD_MAX_PRICE_DEVIATION = '2.25';

      const config = loadConfig();

      expect(config.quoteRefreshCycle).toBe(500);
      expect(config.assets[0].orderSize).toBe(0.005);
      expect(config.assets[0].spreadWidth).toBe(7.5);
      expect(config.assets[0].maxPriceDeviation).toBe(2.25);
    });

    it('should handle malformed numeric values gracefully', () => {
      process.env.TICKERS = 'BTCUSD';
      process.env.QUOTE_REFRESH_CYCLE = 'invalid';
      process.env.BTC_USD_ORDER_SIZE = 'not-a-number';

      const config = loadConfig();

      // Should fall back to defaults when parsing fails
      expect(config.quoteRefreshCycle).toBeNaN();
      expect(config.assets[0].orderSize).toBeNaN();
    });
  });

  describe('loadEtherealConfig', () => {
    it('should load default Ethereal configuration', () => {
      delete process.env.ETHEREAL_LOCAL_BASE_URL;
      delete process.env.ETHEREAL_API_BASE_URL;
      delete process.env.ETHEREAL_TIMEOUT;

      const config = loadEtherealConfig();

      expect(config.localBaseUrl).toBe('http://127.0.0.1');
      expect(config.apiBaseUrl).toBe('https://api.etherealtest.net/v1');
      expect(config.timeout).toBe(10000);
    });

    it('should parse Ethereal environment variables', () => {
      process.env.ETHEREAL_LOCAL_BASE_URL = 'http://localhost:8080';
      process.env.ETHEREAL_API_BASE_URL = 'https://api.ethereal.com/v1';
      process.env.ETHEREAL_TIMEOUT = '5000';

      const config = loadEtherealConfig();

      expect(config.localBaseUrl).toBe('http://localhost:8080');
      expect(config.apiBaseUrl).toBe('https://api.ethereal.com/v1');
      expect(config.timeout).toBe(5000);
    });

    it('should handle partial configuration', () => {
      process.env.ETHEREAL_LOCAL_BASE_URL = 'http://custom:9000';
      // Leave others as defaults

      const config = loadEtherealConfig();

      expect(config.localBaseUrl).toBe('http://custom:9000');
      expect(config.apiBaseUrl).toBe('https://api.etherealtest.net/v1'); // Default
      expect(config.timeout).toBe(10000); // Default
    });

    it('should parse timeout as integer', () => {
      process.env.ETHEREAL_TIMEOUT = '15000';

      const config = loadEtherealConfig();

      expect(config.timeout).toBe(15000);
      expect(typeof config.timeout).toBe('number');
    });

    it('should handle invalid timeout values', () => {
      process.env.ETHEREAL_TIMEOUT = 'invalid';

      const config = loadEtherealConfig();

      expect(config.timeout).toBeNaN();
    });
  });

  describe('environment variable precedence', () => {
    it('should follow correct precedence: asset-specific > global > default', () => {
      process.env.TICKERS = 'BTCUSD,ETHUSD';

      // Set global
      process.env.SPREAD_WIDTH = '20';

      // Set asset-specific for BTC only
      process.env.BTC_USD_SPREAD_WIDTH = '10';

      // ETH should use global, BTC should use asset-specific

      const config = loadConfig();

      expect(config.assets[0].ticker).toBe('BTCUSD');
      expect(config.assets[0].spreadWidth).toBe(10); // Asset-specific

      expect(config.assets[1].ticker).toBe('ETHUSD');
      expect(config.assets[1].spreadWidth).toBe(20); // Global
    });

    it('should handle mixed configuration scenarios', () => {
      process.env.TICKERS = 'BTCUSD,ETHUSD,SOLUSD';

      // Global settings
      process.env.SPREAD_WIDTH = '15';
      process.env.MAX_PRICE_DEVIATION = '4.0';

      // BTC overrides
      process.env.BTC_USD_ORDER_SIZE = '0.001';
      process.env.BTC_USD_SPREAD_WIDTH = '8';

      // SOL overrides
      process.env.SOL_USD_ORDER_SIZE = '5.0';
      process.env.SOL_USD_MAX_PRICE_DEVIATION = '6.0';

      const config = loadConfig();

      // BTC: custom order size and spread, global deviation
      expect(config.assets[0].orderSize).toBe(0.001);
      expect(config.assets[0].spreadWidth).toBe(8);
      expect(config.assets[0].maxPriceDeviation).toBe(4.0);

      // ETH: all global/default
      expect(config.assets[1].orderSize).toBe(100); // Default
      expect(config.assets[1].spreadWidth).toBe(15); // Global
      expect(config.assets[1].maxPriceDeviation).toBe(4.0); // Global

      // SOL: custom order size and deviation, global spread
      expect(config.assets[2].orderSize).toBe(5.0);
      expect(config.assets[2].spreadWidth).toBe(15); // Global
      expect(config.assets[2].maxPriceDeviation).toBe(6.0);
    });
  });

  describe('ticker format handling', () => {
    it('should correctly format ticker prefixes', () => {
      process.env.TICKERS = 'BTCUSD,ETHUSD,LINKUSD';

      // Test that ticker format conversion works
      process.env.BTC_USD_ORDER_SIZE = '0.1';
      process.env.ETH_USD_ORDER_SIZE = '1.0';
      process.env.LINK_USD_ORDER_SIZE = '10.0';

      const config = loadConfig();

      expect(config.assets[0].orderSize).toBe(0.1);
      expect(config.assets[1].orderSize).toBe(1.0);
      expect(config.assets[2].orderSize).toBe(10.0);
    });
  });

  describe('fetchProductInfo', () => {
    // Mock axios for API testing
    const mockAxios = require('axios');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should fetch and parse product info successfully', async () => {
      const mockResponse = {
        data: {
          data: [{
            id: 'BTCUSD_PERP',
            tickSize: '1.0',
            minQuantity: '0.001',
            maxQuantity: '10000.0'
          }]
        }
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await fetchProductInfo('BTCUSD');

      expect(result).toEqual({
        tickSize: 1.0,
        minQuantity: 0.001,
        maxQuantity: 10000.0,
        productId: 'BTCUSD_PERP'
      });

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://api.etherealtest.net/v1/product?ticker=BTCUSD',
        { timeout: 10000 }
      );
    });

    it('should handle API errors gracefully and return defaults', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await fetchProductInfo('BTCUSD');

      expect(result).toEqual({
        tickSize: 1,
        minQuantity: 0.0001,
        maxQuantity: 1000000,
        productId: ''
      });
    });

    it('should handle empty response data', async () => {
      const mockResponse = {
        data: {
          data: []
        }
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await fetchProductInfo('BTCUSD');

      expect(result).toEqual({
        tickSize: 1,
        minQuantity: 0.0001,
        maxQuantity: 1000000,
        productId: ''
      });
    });

    it('should handle malformed response data', async () => {
      const mockResponse = {
        data: null
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await fetchProductInfo('BTCUSD');

      expect(result).toEqual({
        tickSize: 1,
        minQuantity: 0.0001,
        maxQuantity: 1000000,
        productId: ''
      });
    });

    it('should parse string numbers correctly', async () => {
      const mockResponse = {
        data: {
          data: [{
            id: 'ETHUSD_PERP',
            tickSize: '0.01',
            minQuantity: '0.01',
            maxQuantity: '5000.5'
          }]
        }
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await fetchProductInfo('ETHUSD');

      expect(result.tickSize).toBe(0.01);
      expect(result.minQuantity).toBe(0.01);
      expect(result.maxQuantity).toBe(5000.5);
      expect(result.productId).toBe('ETHUSD_PERP');
    });

    it('should use custom Ethereal config for API call', async () => {
      // Set custom config
      process.env.ETHEREAL_API_BASE_URL = 'https://custom.api.com/v2';
      process.env.ETHEREAL_TIMEOUT = '20000';

      const mockResponse = {
        data: {
          data: [{
            id: 'SOLUSD_PERP',
            tickSize: '0.1',
            minQuantity: '1.0',
            maxQuantity: '100000.0'
          }]
        }
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      await fetchProductInfo('SOLUSD');

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://custom.api.com/v2/product?ticker=SOLUSD',
        { timeout: 20000 }
      );
    });

    it('should handle timeout errors', async () => {
      mockAxios.get.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout' });

      const result = await fetchProductInfo('BTCUSD');

      expect(result).toEqual({
        tickSize: 1,
        minQuantity: 0.0001,
        maxQuantity: 1000000,
        productId: ''
      });
    });

    it('should handle 404 errors', async () => {
      mockAxios.get.mockRejectedValue({ response: { status: 404 } });

      const result = await fetchProductInfo('UNKNOWNUSD');

      expect(result).toEqual({
        tickSize: 1,
        minQuantity: 0.0001,
        maxQuantity: 1000000,
        productId: ''
      });
    });
  });
});