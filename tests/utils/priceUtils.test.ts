import {
  roundToTickSize,
  basisPointsToDecimal,
  calculateBidPrice,
  calculateAskPrice,
  calculateMaxDeviationAmount,
  calculatePriceDeviation,
  calculateRoundedBidAsk,
  calculateSpreadAmount
} from '../../src/utils/priceUtils';

describe('PriceUtils', () => {
  describe('roundToTickSize', () => {
    it('should round price to nearest tick size multiple', () => {
      expect(roundToTickSize(100.123, 0.01)).toBe(100.12);
      expect(roundToTickSize(100.126, 0.01)).toBe(100.13);
      expect(roundToTickSize(50000.7, 1)).toBe(50001);
      expect(roundToTickSize(50000.4, 1)).toBe(50000);
    });

    it('should handle edge cases', () => {
      expect(roundToTickSize(0, 0.01)).toBe(0);
      expect(roundToTickSize(100, 1)).toBe(100);
      expect(roundToTickSize(100.5, 1)).toBe(101);
    });

    it('should work with different tick sizes', () => {
      expect(roundToTickSize(1234.567, 0.001)).toBe(1234.567);
      expect(roundToTickSize(1234.5678, 0.001)).toBe(1234.568);
      expect(roundToTickSize(1250, 25)).toBe(1250);
      expect(roundToTickSize(1237, 25)).toBe(1225);
    });
  });

  describe('basisPointsToDecimal', () => {
    it('should convert basis points to decimal correctly', () => {
      expect(basisPointsToDecimal(100)).toBe(0.01); // 1%
      expect(basisPointsToDecimal(50)).toBe(0.005); // 0.5%
      expect(basisPointsToDecimal(1)).toBe(0.0001); // 0.01%
      expect(basisPointsToDecimal(10000)).toBe(1); // 100%
    });

    it('should handle zero and negative values', () => {
      expect(basisPointsToDecimal(0)).toBe(0);
      expect(basisPointsToDecimal(-100)).toBe(-0.01);
    });
  });

  describe('calculateBidPrice', () => {
    it('should calculate bid price correctly', () => {
      // 50000 - (50000 * 100bp) = 50000 - 500 = 49500
      expect(calculateBidPrice(50000, 100)).toBe(49500);

      // 2500 - (2500 * 200bp) = 2500 - 50 = 2450
      expect(calculateBidPrice(2500, 200)).toBe(2450);

      // 100 - (100 * 50bp) = 100 - 0.5 = 99.5
      expect(calculateBidPrice(100, 50)).toBe(99.5);
    });

    it('should handle zero spread', () => {
      expect(calculateBidPrice(1000, 0)).toBe(1000);
    });

    it('should handle large spreads', () => {
      // 1000 - (1000 * 50%) = 1000 - 500 = 500
      expect(calculateBidPrice(1000, 5000)).toBe(500);
    });
  });

  describe('calculateAskPrice', () => {
    it('should calculate ask price correctly', () => {
      // 50000 + (50000 * 100bp) = 50000 + 500 = 50500
      expect(calculateAskPrice(50000, 100)).toBe(50500);

      // 2500 + (2500 * 200bp) = 2500 + 50 = 2550
      expect(calculateAskPrice(2500, 200)).toBe(2550);

      // 100 + (100 * 50bp) = 100 + 0.5 = 100.5
      expect(calculateAskPrice(100, 50)).toBe(100.5);
    });

    it('should handle zero spread', () => {
      expect(calculateAskPrice(1000, 0)).toBe(1000);
    });

    it('should handle large spreads', () => {
      // 1000 + (1000 * 50%) = 1000 + 500 = 1500
      expect(calculateAskPrice(1000, 5000)).toBe(1500);
    });
  });

  describe('calculateMaxDeviationAmount', () => {
    it('should calculate deviation amount correctly', () => {
      // 5% of 1000 = 50
      expect(calculateMaxDeviationAmount(1000, 5)).toBe(50);

      // 2% of 50000 = 1000
      expect(calculateMaxDeviationAmount(50000, 2)).toBe(1000);

      // 0.1% of 2500 = 2.5
      expect(calculateMaxDeviationAmount(2500, 0.1)).toBe(2.5);
    });

    it('should handle zero deviation', () => {
      expect(calculateMaxDeviationAmount(1000, 0)).toBe(0);
    });

    it('should handle 100% deviation', () => {
      expect(calculateMaxDeviationAmount(1000, 100)).toBe(1000);
    });
  });

  describe('calculatePriceDeviation', () => {
    it('should calculate absolute price deviation', () => {
      expect(calculatePriceDeviation(1000, 1050)).toBe(50);
      expect(calculatePriceDeviation(1050, 1000)).toBe(50);
      expect(calculatePriceDeviation(2500, 2400)).toBe(100);
      expect(calculatePriceDeviation(100.5, 99.2)).toBeCloseTo(1.3, 10);
    });

    it('should handle same prices', () => {
      expect(calculatePriceDeviation(1000, 1000)).toBe(0);
    });

    it('should handle zero prices', () => {
      expect(calculatePriceDeviation(0, 100)).toBe(100);
      expect(calculatePriceDeviation(100, 0)).toBe(100);
      expect(calculatePriceDeviation(0, 0)).toBe(0);
    });
  });

  describe('calculateRoundedBidAsk', () => {
    it('should calculate and round bid/ask prices', () => {
      const result = calculateRoundedBidAsk(50000, 100, 1); // 100bp spread, $1 tick

      expect(result.bidPrice).toBe(49500); // 50000 - 500, rounded to $1
      expect(result.askPrice).toBe(50500); // 50000 + 500, rounded to $1
    });

    it('should handle fractional tick sizes', () => {
      const result = calculateRoundedBidAsk(100, 100, 0.01); // 100bp spread, $0.01 tick

      expect(result.bidPrice).toBe(99.00); // 100 - 1, rounded to $0.01
      expect(result.askPrice).toBe(101.00); // 100 + 1, rounded to $0.01
    });

    it('should handle rounding correctly', () => {
      // Price 100.15, 50bp spread (0.5%), tick size 0.1
      // Bid: 100.15 - 0.5005 = 99.6495 → rounds to 99.6
      // Ask: 100.15 + 0.5005 = 100.6505 → rounds to 100.7
      const result = calculateRoundedBidAsk(100.15, 50, 0.1);

      expect(result.bidPrice).toBeCloseTo(99.6, 10);
      expect(result.askPrice).toBeCloseTo(100.7, 10);
    });
  });

  describe('calculateSpreadAmount', () => {
    it('should calculate spread amount correctly', () => {
      // 100bp of 50000 = 500
      expect(calculateSpreadAmount(50000, 100)).toBe(500);

      // 200bp of 2500 = 50
      expect(calculateSpreadAmount(2500, 200)).toBe(50);

      // 50bp of 100 = 0.5
      expect(calculateSpreadAmount(100, 50)).toBe(0.5);
    });

    it('should handle zero spread', () => {
      expect(calculateSpreadAmount(1000, 0)).toBe(0);
    });

    it('should handle large spreads', () => {
      // 50% of 1000 = 500
      expect(calculateSpreadAmount(1000, 5000)).toBe(500);
    });
  });

  describe('integration tests', () => {
    it('should maintain consistent bid/ask spread', () => {
      const midPrice = 50000;
      const spreadBp = 100; // 10bp

      const bidPrice = calculateBidPrice(midPrice, spreadBp);
      const askPrice = calculateAskPrice(midPrice, spreadBp);
      const expectedSpread = calculateSpreadAmount(midPrice, spreadBp);

      // Bid should be mid - spread
      expect(bidPrice).toBe(midPrice - expectedSpread);

      // Ask should be mid + spread
      expect(askPrice).toBe(midPrice + expectedSpread);

      // Spread should be ask - bid
      expect(askPrice - bidPrice).toBe(expectedSpread * 2);
    });

    it('should handle realistic trading scenarios', () => {
      // BTC at $45,000 with 5bp spread
      const btcPrice = 45000;
      const btcSpread = 50; // 5bp
      const btcTick = 1;

      const btcPrices = calculateRoundedBidAsk(btcPrice, btcSpread, btcTick);

      expect(btcPrices.bidPrice).toBe(44775); // 45000 - 225 = 44775
      expect(btcPrices.askPrice).toBe(45225); // 45000 + 225 = 45225

      // ETH at $2,500 with 8bp spread
      const ethPrice = 2500;
      const ethSpread = 80; // 8bp
      const ethTick = 0.01;

      const ethPrices = calculateRoundedBidAsk(ethPrice, ethSpread, ethTick);

      expect(ethPrices.bidPrice).toBe(2480.00); // 2500 - 20 = 2480 (80bp = 0.8%)
      expect(ethPrices.askPrice).toBe(2520.00); // 2500 + 20 = 2520
    });
  });
});