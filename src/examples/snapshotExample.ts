import 'dotenv/config';
import { HermesPriceClient } from '../services/HermesPriceClient';
import { PriceSnapshotService } from '../services/PriceSnapshotService';
import { IPriceClient } from '../interfaces/IPriceClient';
import { PriceUpdate } from '../types/price';
import { PriceSnapshot } from '../types/snapshot';
import { loadConfig } from '../config/marketConfig';

async function runSnapshotExample() {
  const config = loadConfig();

  const priceClient: IPriceClient = new HermesPriceClient({
    endpoint: 'https://hermes.pyth.network',
    reconnectInterval: 5000,
    maxReconnectAttempts: 5
  });

  const snapshotManager = new PriceSnapshotService(config.quoteRefreshCycle);

  // Set up price update handling
  priceClient.onPriceUpdate((priceUpdate: PriceUpdate) => {
    snapshotManager.updatePrice(priceUpdate);
  });

  // Set up snapshot handling
  snapshotManager.onSnapshot((snapshot: PriceSnapshot) => {
    console.log(`[${new Date(snapshot.timestamp).toISOString()}] ${snapshot.ticker}: $${snapshot.price.toFixed(2)}`);
  });

  priceClient.onConnectionStatus((status, error) => {
    console.log(`Connection status: ${status}`);
    if (error) {
      console.error('Connection error:', error.message);
    }
  });

  try {
    console.log('Connecting to Hermes...');
    await priceClient.connect();

    console.log('Subscribing to price feeds...');
    const tickers = config.assets.map(asset => asset.ticker);
    await priceClient.subscribe(tickers);

    console.log('Starting snapshot manager...');
    snapshotManager.start();

    console.log(`Listening for price updates and taking snapshots every ${config.quoteRefreshCycle}ms...`);
    console.log('Press Ctrl+C to stop');

    // Log configuration
    console.log('\nConfiguration:');
    config.assets.forEach(asset => {
      console.log(`${asset.ticker}: Order Size: ${asset.orderSize}, Spread: ${asset.spreadWidth}bp, Max Deviation: ${asset.maxPriceDeviation}%`);
    });

    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      snapshotManager.stop();
      await priceClient.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start snapshot example:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runSnapshotExample();
}