import axios from 'axios';

/**
 * Market making configuration system
 *
 * This module handles loading and parsing of market making configuration from
 * environment variables, providing asset-specific settings and exchange API
 * configuration. It supports both global defaults and per-asset overrides.
 */

/**
 * Configuration for a single trading asset
 *
 * Contains all parameters needed for market making on a specific trading pair,
 * including order sizing, spread configuration, and risk management settings.
 */
export interface AssetConfig {
  /** Trading pair symbol (e.g., 'BTCUSD', 'ETHUSD') */
  ticker: string;
  /** Order quantity in base currency units (not dollar amount) */
  orderSize: number; // quantity, not dollar amount
  /** Bid-ask spread width in basis points (100 bp = 1%) */
  spreadWidth: number;
  /** Maximum price deviation percentage before order cancellation (e.g., 5.0 = 5%) */
  maxPriceDeviation: number;
  /** Minimum price increment for this trading pair (from exchange) */
  tickSize?: number;
  /** Minimum allowed order quantity (from exchange) */
  minQuantity?: number;
  /** Maximum allowed order quantity (from exchange) */
  maxQuantity?: number;
  /** Exchange product ID for API calls (from exchange) */
  productId?: string;
}

/**
 * Complete market making system configuration
 *
 * Contains global settings and per-asset configurations for the entire
 * market making operation.
 */
export interface MarketMakingConfig {
  /** How often to check and refresh quotes, in milliseconds */
  quoteRefreshCycle: number; // in milliseconds
  /** Array of asset-specific configurations */
  assets: AssetConfig[];
}

/**
 * Loads market making configuration from environment variables
 *
 * Environment Variable Parsing Strategy:
 * 1. TICKERS: Comma-separated list of trading pairs (default: BTC,ETH,SOL)
 * 2. Per-asset variables using pattern: {TICKER}_USD_{SETTING}
 *    - Example: BTC_USD_ORDER_SIZE, ETH_USD_SPREAD_WIDTH
 * 3. Global fallback variables: SPREAD_WIDTH, MAX_PRICE_DEVIATION
 * 4. QUOTE_REFRESH_CYCLE: Global refresh interval
 *
 * Asset-specific environment variables take precedence over global ones.
 * This allows fine-tuning individual assets while maintaining global defaults.
 *
 * @returns Complete market making configuration
 * @example
 * // Environment variables:
 * // TICKERS=BTCUSD,ETHUSD
 * // BTC_USD_ORDER_SIZE=0.001
 * // ETH_USD_ORDER_SIZE=0.01
 * // SPREAD_WIDTH=20
 * // QUOTE_REFRESH_CYCLE=1000
 *
 * const config = loadConfig();
 * // Returns config with 2 assets, each with their specific order sizes
 * // but both using global SPREAD_WIDTH of 20 bp
 */
export const loadConfig = (): MarketMakingConfig => {
  const tickers = process.env.TICKERS ? process.env.TICKERS.split(',') : ['BTCUSD', 'ETHUSD', 'SOLUSD'];

  const assets: AssetConfig[] = tickers.map(ticker => {
    // Convert ticker format for environment variable naming
    // 'BTCUSD' -> 'BTC_USD' for env var prefix
    const envPrefix = ticker.replace('USD', '_USD');
    return {
      ticker,
      orderSize: parseFloat(process.env[`${envPrefix}_ORDER_SIZE`] || '100'),
      spreadWidth: parseFloat(process.env[`${envPrefix}_SPREAD_WIDTH`] || process.env.SPREAD_WIDTH || '10'),
      maxPriceDeviation: parseFloat(process.env[`${envPrefix}_MAX_PRICE_DEVIATION`] || process.env.MAX_PRICE_DEVIATION || '1.0')
    };
  });

  return {
    quoteRefreshCycle: parseInt(process.env.QUOTE_REFRESH_CYCLE || '5000'),
    assets
  };
};

/**
 * Loads Ethereal exchange API configuration from environment variables
 *
 * Supports dual API configuration:
 * - localBaseUrl: Local proxy/gateway for order operations (lower latency)
 * - apiBaseUrl: Direct Ethereal API for data queries and account operations
 *
 * @returns Ethereal API configuration object
 */
export const loadEtherealConfig = () => {
  return {
    localBaseUrl: process.env.ETHEREAL_LOCAL_BASE_URL || 'http://127.0.0.1',
    apiBaseUrl: process.env.ETHEREAL_API_BASE_URL || 'https://api.etherealtest.net/v1',
    timeout: parseInt(process.env.ETHEREAL_TIMEOUT || '10000')
  };
};

/**
 * Fetches trading pair specifications from Ethereal exchange
 *
 * Retrieves critical trading parameters needed for order placement:
 * - tickSize: Minimum price increment (needed for valid order prices)
 * - minQuantity: Minimum order size (prevents rejected orders)
 * - maxQuantity: Maximum order size (prevents rejected orders)
 * - productId: Exchange identifier (needed for position queries)
 *
 * This function is typically called during bot initialization to populate
 * AssetConfig objects with exchange-specific constraints.
 *
 * Error Handling:
 * - Returns sensible defaults if API call fails
 * - Logs errors but doesn't crash the application
 * - Allows bot to start even if some product info is unavailable
 *
 * @param ticker Trading pair symbol (e.g., 'BTCUSD')
 * @returns Product specification object with trading constraints
 * @throws Never throws - returns defaults on any error
 */
export const fetchProductInfo = async (ticker: string): Promise<{tickSize: number, minQuantity: number, maxQuantity: number, productId: string}> => {
  const etherealConfig = loadEtherealConfig();
  const url = `${etherealConfig.apiBaseUrl}/product?ticker=${ticker}`;

  try {
    const response = await axios.get(url, { timeout: etherealConfig.timeout });

    if (response.data && response.data.data && response.data.data.length > 0) {
      const product = response.data.data[0];
      return {
        tickSize: parseFloat(product.tickSize),
        minQuantity: parseFloat(product.minQuantity),
        maxQuantity: parseFloat(product.maxQuantity),
        productId: product.id
      };
    } else {
      throw new Error(`No product data found for ${ticker}`);
    }
  } catch (error) {
    console.error(`Error fetching product info for ${ticker}:`, error);
    // Return defaults if API call fails - allows bot to continue running
    return {
      tickSize: 1,
      minQuantity: 0.0001,
      maxQuantity: 1000000,
      productId: ''
    };
  }
};