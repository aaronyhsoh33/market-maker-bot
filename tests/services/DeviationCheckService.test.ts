import { DeviationCheckService } from '../../src/services/DeviationCheckService';
import { TradingPair, MarketState, Order, Position } from '../../src/types/marketMaker';

// Mock the config loading
jest.mock('../../src/config/marketConfig', () => ({
  loadConfig: () => ({
    quoteRefreshCycle: 1000,
    assets: [
      { ticker: 'BTCUSD', orderSize: 0.001, spreadWidth: 10, maxPriceDeviation: 5.0 },
      { ticker: 'ETHUSD', orderSize: 0.01, spreadWidth: 15, maxPriceDeviation: 3.0 },
      { ticker: 'SOLUSD', orderSize: 1.0, spreadWidth: 20, maxPriceDeviation: 7.0 }
    ]
  })
}));

describe('DeviationCheckService', () => {
  let service: DeviationCheckService;

  beforeEach(() => {
    service = new DeviationCheckService();
  });

  describe('calculateMarketState', () => {
    it('should calculate market state for BTC with correct spread', () => {
      const marketState = service.calculateMarketState('BTCUSD', 50000, 5.0);

      expect(marketState.ticker).toBe('BTCUSD');
      expect(marketState.midPrice).toBe(50000);
      expect(marketState.maxDeviationPrice).toBe(2500); // 5% of 50000

      // Spread: 10bp of 50000 = 50
      // Bid: 50000 - 25 = 49975, Ask: 50000 + 25 = 50025
      expect(marketState.bidPrice).toBe(49975);
      expect(marketState.askPrice).toBe(50025);
      expect(marketState.timestamp).toBeCloseTo(Date.now(), -2);
    });

    it('should calculate market state for ETH with different spread', () => {
      const marketState = service.calculateMarketState('ETHUSD', 2500, 3.0);

      expect(marketState.ticker).toBe('ETHUSD');
      expect(marketState.midPrice).toBe(2500);
      expect(marketState.maxDeviationPrice).toBe(75); // 3% of 2500

      // Spread: 15bp of 2500 = 3.75
      // Bid: 2500 - 1.875 = 2498.125, Ask: 2500 + 1.875 = 2501.875
      expect(marketState.bidPrice).toBe(2498.125);
      expect(marketState.askPrice).toBe(2501.875);
    });

    it('should calculate market state for SOL', () => {
      const marketState = service.calculateMarketState('SOLUSD', 100, 7.0);

      expect(marketState.ticker).toBe('SOLUSD');
      expect(marketState.midPrice).toBe(100);
      expect(marketState.maxDeviationPrice).toBeCloseTo(7, 10); // 7% of 100

      // Spread: 20bp of 100 = 0.2
      // Bid: 100 - 0.1 = 99.9, Ask: 100 + 0.1 = 100.1
      expect(marketState.bidPrice).toBe(99.9);
      expect(marketState.askPrice).toBe(100.1);
    });

    it('should handle unknown ticker with default spread', () => {
      const marketState = service.calculateMarketState('UNKNOWNUSD', 1000, 2.0);

      expect(marketState.ticker).toBe('UNKNOWNUSD');
      expect(marketState.midPrice).toBe(1000);
      expect(marketState.maxDeviationPrice).toBe(20); // 2% of 1000

      // Default spread: 10bp of 1000 = 1
      // Bid: 1000 - 0.5 = 999.5, Ask: 1000 + 0.5 = 1000.5
      expect(marketState.bidPrice).toBe(999.5);
      expect(marketState.askPrice).toBe(1000.5);
    });

    it('should handle zero price correctly', () => {
      const marketState = service.calculateMarketState('BTCUSD', 0, 5.0);

      expect(marketState.midPrice).toBe(0);
      expect(marketState.maxDeviationPrice).toBe(0);
      expect(marketState.bidPrice).toBe(0);
      expect(marketState.askPrice).toBe(0);
    });

    it('should handle zero deviation', () => {
      const marketState = service.calculateMarketState('BTCUSD', 50000, 0);

      expect(marketState.maxDeviationPrice).toBe(0);
      expect(marketState.bidPrice).toBe(49975); // Spread still applies
      expect(marketState.askPrice).toBe(50025);
    });
  });

  describe('checkOrdersAndPositions', () => {
    let marketState: MarketState;

    beforeEach(() => {
      marketState = {
        ticker: 'BTCUSD',
        midPrice: 50000,
        bidPrice: 49975,
        askPrice: 50025,
        maxDeviationPrice: 1000, // 2% deviation
        timestamp: Date.now()
      };
    });

    describe('bid order checking', () => {
      it('should not cancel bid order within deviation range', () => {
        const tradingPair: TradingPair = {
          ticker: 'BTCUSD',
          bidOrder: {
            id: 'bid-1',
            ticker: 'BTCUSD',
            side: 'BID',
            price: 49500, // 500 below mid, within 1000 range
            quantity: 0.001,
            quantityFilled: 0,
            status: 'NEW',
            timestamp: Date.now()
          }
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldCancelBid).toBe(false);
      });

      it('should cancel bid order outside deviation range', () => {
        const tradingPair: TradingPair = {
          ticker: 'BTCUSD',
          bidOrder: {
            id: 'bid-1',
            ticker: 'BTCUSD',
            side: 'BID',
            price: 48500, // 1500 below mid, outside 1000 range
            quantity: 0.001,
            quantityFilled: 0,
            status: 'NEW',
            timestamp: Date.now()
          }
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldCancelBid).toBe(true);
      });

      it('should not check non-NEW bid orders', () => {
        const tradingPair: TradingPair = {
          ticker: 'BTCUSD',
          bidOrder: {
            id: 'bid-1',
            ticker: 'BTCUSD',
            side: 'BID',
            price: 48000, // Far outside range
            quantity: 0.001,
            quantityFilled: 0.001,
            status: 'FILLED',
            timestamp: Date.now()
          }
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldCancelBid).toBe(false);
      });

      it('should handle missing bid order', () => {
        const tradingPair: TradingPair = {
          ticker: 'BTCUSD'
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldCancelBid).toBe(false);
      });
    });

    describe('ask order checking', () => {
      it('should not cancel ask order within deviation range', () => {
        const tradingPair: TradingPair = {
          ticker: 'BTCUSD',
          askOrder: {
            id: 'ask-1',
            ticker: 'BTCUSD',
            side: 'ASK',
            price: 50800, // 800 above mid, within 1000 range
            quantity: 0.001,
            quantityFilled: 0,
            status: 'NEW',
            timestamp: Date.now()
          }
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldCancelAsk).toBe(false);
      });

      it('should cancel ask order outside deviation range', () => {
        const tradingPair: TradingPair = {
          ticker: 'BTCUSD',
          askOrder: {
            id: 'ask-1',
            ticker: 'BTCUSD',
            side: 'ASK',
            price: 51500, // 1500 above mid, outside 1000 range
            quantity: 0.001,
            quantityFilled: 0,
            status: 'NEW',
            timestamp: Date.now()
          }
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldCancelAsk).toBe(true);
      });

      it('should not check non-NEW ask orders', () => {
        const tradingPair: TradingPair = {
          ticker: 'BTCUSD',
          askOrder: {
            id: 'ask-1',
            ticker: 'BTCUSD',
            side: 'ASK',
            price: 52000, // Far outside range
            quantity: 0.001,
            quantityFilled: 0,
            status: 'CANCELED',
            timestamp: Date.now()
          }
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldCancelAsk).toBe(false);
      });
    });

    describe('position checking', () => {
      it('should not close long position within deviation range', () => {
        const tradingPair: TradingPair = {
          ticker: 'BTCUSD',
          longPosition: {
            ticker: 'BTCUSD',
            side: 'LONG',
            quantity: 0.001,
            entryPrice: 49500, // 500 below mid, within 1000 range
            timestamp: Date.now()
          }
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldClosePositions).toBe(false);
      });

      it('should close long position outside deviation range', () => {
        const tradingPair: TradingPair = {
          ticker: 'BTCUSD',
          longPosition: {
            ticker: 'BTCUSD',
            side: 'LONG',
            quantity: 0.001,
            entryPrice: 48000, // 2000 below mid, outside 1000 range
            timestamp: Date.now()
          }
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldClosePositions).toBe(true);
      });

      it('should not close short position within deviation range', () => {
        const tradingPair: TradingPair = {
          ticker: 'BTCUSD',
          shortPosition: {
            ticker: 'BTCUSD',
            side: 'SHORT',
            quantity: 0.001,
            entryPrice: 50800, // 800 above mid, within 1000 range
            timestamp: Date.now()
          }
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldClosePositions).toBe(false);
      });

      it('should close short position outside deviation range', () => {
        const tradingPair: TradingPair = {
          ticker: 'BTCUSD',
          shortPosition: {
            ticker: 'BTCUSD',
            side: 'SHORT',
            quantity: 0.001,
            entryPrice: 52000, // 2000 above mid, outside 1000 range
            timestamp: Date.now()
          }
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldClosePositions).toBe(true);
      });

      it('should handle both long and short positions', () => {
        const tradingPair: TradingPair = {
          ticker: 'BTCUSD',
          longPosition: {
            ticker: 'BTCUSD',
            side: 'LONG',
            quantity: 0.001,
            entryPrice: 47000, // Outside range
            timestamp: Date.now()
          },
          shortPosition: {
            ticker: 'BTCUSD',
            side: 'SHORT',
            quantity: 0.001,
            entryPrice: 53000, // Outside range
            timestamp: Date.now()
          }
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldClosePositions).toBe(true);
      });
    });

    describe('complex scenarios', () => {
      it('should handle multiple issues simultaneously', () => {
        const tradingPair: TradingPair = {
          ticker: 'BTCUSD',
          bidOrder: {
            id: 'bid-1',
            ticker: 'BTCUSD',
            side: 'BID',
            price: 47000, // Outside range
            quantity: 0.001,
            quantityFilled: 0,
            status: 'NEW',
            timestamp: Date.now()
          },
          askOrder: {
            id: 'ask-1',
            ticker: 'BTCUSD',
            side: 'ASK',
            price: 53000, // Outside range
            quantity: 0.001,
            quantityFilled: 0,
            status: 'NEW',
            timestamp: Date.now()
          },
          longPosition: {
            ticker: 'BTCUSD',
            side: 'LONG',
            quantity: 0.001,
            entryPrice: 46000, // Outside range
            timestamp: Date.now()
          }
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldCancelBid).toBe(true);
        expect(result.shouldCancelAsk).toBe(true);
        expect(result.shouldClosePositions).toBe(true);
      });

      it('should handle edge case at deviation boundary', () => {
        const tradingPair: TradingPair = {
          ticker: 'BTCUSD',
          bidOrder: {
            id: 'bid-1',
            ticker: 'BTCUSD',
            side: 'BID',
            price: 49000, // Exactly 1000 deviation
            quantity: 0.001,
            quantityFilled: 0,
            status: 'NEW',
            timestamp: Date.now()
          }
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldCancelBid).toBe(false); // Exactly at boundary should be safe
      });

      it('should handle zero deviation threshold', () => {
        marketState.maxDeviationPrice = 0;

        const tradingPair: TradingPair = {
          ticker: 'BTCUSD',
          bidOrder: {
            id: 'bid-1',
            ticker: 'BTCUSD',
            side: 'BID',
            price: 49999, // Any deviation should trigger cancellation
            quantity: 0.001,
            quantityFilled: 0,
            status: 'NEW',
            timestamp: Date.now()
          }
        };

        const result = service.checkOrdersAndPositions(tradingPair, marketState);

        expect(result.shouldCancelBid).toBe(true);
      });
    });
  });
});