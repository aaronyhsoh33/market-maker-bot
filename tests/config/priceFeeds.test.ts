import {
  PRICE_FEEDS,
  getAllPriceIds,
  getPriceFeedByTicker,
  getPriceFeedById,
  PriceFeedConfig
} from '../../src/config/priceFeeds';

describe('PriceFeeds', () => {
  describe('PRICE_FEEDS constant', () => {
    it('should contain expected trading pairs', () => {
      expect(PRICE_FEEDS).toHaveProperty('BTCUSD');
      expect(PRICE_FEEDS).toHaveProperty('ETHUSD');
      expect(PRICE_FEEDS).toHaveProperty('SOLUSD');
    });

    it('should have correct structure for each feed', () => {
      Object.values(PRICE_FEEDS).forEach((feed: PriceFeedConfig) => {
        expect(feed).toHaveProperty('ticker');
        expect(feed).toHaveProperty('priceId');
        expect(feed).toHaveProperty('description');
        expect(typeof feed.ticker).toBe('string');
        expect(typeof feed.priceId).toBe('string');
        expect(typeof feed.description).toBe('string');
        expect(feed.priceId).toMatch(/^0x[a-f0-9]{64}$/); // Valid hex string
      });
    });

    it('should have consistent ticker format', () => {
      Object.entries(PRICE_FEEDS).forEach(([key, feed]) => {
        expect(key).toBe(feed.ticker);
        expect(feed.ticker).toMatch(/^[A-Z]+USD$/);
      });
    });
  });

  describe('getAllPriceIds', () => {
    it('should return all price IDs', () => {
      const priceIds = getAllPriceIds();

      expect(priceIds).toHaveLength(3);
      expect(priceIds).toContain(PRICE_FEEDS.BTCUSD.priceId);
      expect(priceIds).toContain(PRICE_FEEDS.ETHUSD.priceId);
      expect(priceIds).toContain(PRICE_FEEDS.SOLUSD.priceId);
    });

    it('should return only strings', () => {
      const priceIds = getAllPriceIds();
      priceIds.forEach(id => {
        expect(typeof id).toBe('string');
        expect(id).toMatch(/^0x[a-f0-9]{64}$/);
      });
    });

    it('should return unique IDs', () => {
      const priceIds = getAllPriceIds();
      const uniqueIds = new Set(priceIds);
      expect(uniqueIds.size).toBe(priceIds.length);
    });
  });

  describe('getPriceFeedByTicker', () => {
    it('should return correct feed for valid tickers', () => {
      const btcFeed = getPriceFeedByTicker('BTCUSD');
      expect(btcFeed).toEqual(PRICE_FEEDS.BTCUSD);

      const ethFeed = getPriceFeedByTicker('ETHUSD');
      expect(ethFeed).toEqual(PRICE_FEEDS.ETHUSD);

      const solFeed = getPriceFeedByTicker('SOLUSD');
      expect(solFeed).toEqual(PRICE_FEEDS.SOLUSD);
    });

    it('should return undefined for invalid tickers', () => {
      expect(getPriceFeedByTicker('INVALID')).toBeUndefined();
      expect(getPriceFeedByTicker('DOGUSD')).toBeUndefined();
      expect(getPriceFeedByTicker('')).toBeUndefined();
    });

    it('should be case sensitive', () => {
      expect(getPriceFeedByTicker('btcusd')).toBeUndefined();
      expect(getPriceFeedByTicker('BtcUsd')).toBeUndefined();
    });

    it('should handle whitespace', () => {
      expect(getPriceFeedByTicker(' BTCUSD ')).toBeUndefined();
      expect(getPriceFeedByTicker('BTC USD')).toBeUndefined();
    });
  });

  describe('getPriceFeedById', () => {
    it('should return correct feed for valid price IDs', () => {
      const btcFeed = getPriceFeedById(PRICE_FEEDS.BTCUSD.priceId);
      expect(btcFeed).toEqual(PRICE_FEEDS.BTCUSD);

      const ethFeed = getPriceFeedById(PRICE_FEEDS.ETHUSD.priceId);
      expect(ethFeed).toEqual(PRICE_FEEDS.ETHUSD);

      const solFeed = getPriceFeedById(PRICE_FEEDS.SOLUSD.priceId);
      expect(solFeed).toEqual(PRICE_FEEDS.SOLUSD);
    });

    it('should handle IDs with and without 0x prefix', () => {
      const btcPriceId = PRICE_FEEDS.BTCUSD.priceId;
      const idWithoutPrefix = btcPriceId.substring(2); // Remove '0x'

      const feedWithPrefix = getPriceFeedById(btcPriceId);
      const feedWithoutPrefix = getPriceFeedById(idWithoutPrefix);

      expect(feedWithPrefix).toEqual(PRICE_FEEDS.BTCUSD);
      expect(feedWithoutPrefix).toEqual(PRICE_FEEDS.BTCUSD);
      expect(feedWithPrefix).toEqual(feedWithoutPrefix);
    });

    it('should return undefined for invalid price IDs', () => {
      expect(getPriceFeedById('invalid')).toBeUndefined();
      expect(getPriceFeedById('0x1234567890abcdef')).toBeUndefined();
      expect(getPriceFeedById('')).toBeUndefined();
    });

    it('should handle malformed hex strings', () => {
      expect(getPriceFeedById('0xINVALIDHEX')).toBeUndefined();
      expect(getPriceFeedById('notahexstring')).toBeUndefined();
    });

    it('should be case sensitive for hex characters', () => {
      const btcPriceId = PRICE_FEEDS.BTCUSD.priceId;
      const upperCaseId = btcPriceId.toUpperCase();

      expect(getPriceFeedById(btcPriceId)).toEqual(PRICE_FEEDS.BTCUSD);
      expect(getPriceFeedById(upperCaseId)).toBeUndefined(); // Case sensitive
    });
  });

  describe('integration tests', () => {
    it('should maintain consistency between lookup methods', () => {
      Object.entries(PRICE_FEEDS).forEach(([ticker, expectedFeed]) => {
        const feedByTicker = getPriceFeedByTicker(ticker);
        const feedById = getPriceFeedById(expectedFeed.priceId);

        expect(feedByTicker).toEqual(expectedFeed);
        expect(feedById).toEqual(expectedFeed);
        expect(feedByTicker).toEqual(feedById);
      });
    });

    it('should support full price feed workflow', () => {
      // Get all price IDs
      const allIds = getAllPriceIds();
      expect(allIds.length).toBeGreaterThan(0);

      // Look up each feed by ID
      allIds.forEach(priceId => {
        const feed = getPriceFeedById(priceId);
        expect(feed).toBeDefined();

        if (feed) {
          // Verify we can look it up by ticker too
          const sameFeed = getPriceFeedByTicker(feed.ticker);
          expect(sameFeed).toEqual(feed);
        }
      });
    });

    it('should have valid data structure for all feeds', () => {
      const allIds = getAllPriceIds();

      allIds.forEach(priceId => {
        const feed = getPriceFeedById(priceId);
        expect(feed).toBeDefined();

        if (feed) {
          expect(feed.ticker).toBeTruthy();
          expect(feed.priceId).toBeTruthy();
          expect(feed.description).toBeTruthy();
          // Check if description contains currency name (Bitcoin->BTC, Ethereum->ETH, Solana->SOL)
          const ticker = feed.ticker.substring(0, 3).toLowerCase();
          const description = feed.description.toLowerCase();
          const currencyMap: Record<string, string> = {
            'btc': 'bitcoin',
            'eth': 'ethereum',
            'sol': 'solana'
          };
          expect(description).toContain(currencyMap[ticker] || ticker);
        }
      });
    });
  });
});