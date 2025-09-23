/**
 * Price snapshot types for market making operations
 *
 * Defines data structures for storing and managing historical price
 * snapshots used in market making decision processes and monitoring.
 */

/**
 * Point-in-time price snapshot for a trading pair
 *
 * Captures price data at a specific moment for historical analysis,
 * trend detection, and market making strategy evaluation.
 */
export interface PriceSnapshot {
  /** Trading pair symbol */
  ticker: string;
  /** Price at snapshot time */
  price: number;
  /** Price confidence level */
  confidence: number;
  /** Snapshot timestamp in Unix milliseconds */
  timestamp: number;
}

/**
 * Storage structure for organizing price snapshots by trading pair
 *
 * Maintains historical price data for multiple trading pairs,
 * enabling analysis and monitoring across different assets.
 */
export interface SnapshotStorage {
  /** Map of ticker symbols to their historical snapshots */
  [ticker: string]: PriceSnapshot[];
}

/**
 * Callback function type for snapshot notifications
 *
 * Called when new price snapshots are created, allowing external
 * systems to react to market data updates and perform analytics.
 */
export type SnapshotCallback = (snapshot: PriceSnapshot) => void;