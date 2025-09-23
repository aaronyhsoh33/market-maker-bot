import { HermesPriceClient } from '../services/HermesPriceClient';
import { IPriceClient } from '../interfaces/IPriceClient';
import { PriceUpdate } from '../types/price';

async function runPriceClientExample() {
  const priceClient: IPriceClient = new HermesPriceClient({
    endpoint: 'https://hermes.pyth.network',
    reconnectInterval: 5000,
    maxReconnectAttempts: 5
  });

  priceClient.onPriceUpdate((priceUpdate: PriceUpdate) => {
    console.log(`[${new Date(priceUpdate.timestamp).toISOString()}] ${priceUpdate.ticker}: $${priceUpdate.price.toFixed(2)} (±$${priceUpdate.confidence.toFixed(2)})`);
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
    await priceClient.subscribe(['BTC/USD', 'ETH/USD', 'SOL/USD']);

    console.log('Listening for price updates... (Press Ctrl+C to stop)');

    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await priceClient.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start price client:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runPriceClientExample();
}