import 'dotenv/config';
import { HermesPriceClient } from './services/HermesPriceClient';
import { PriceSnapshotService } from './services/PriceSnapshotService';
import { EtherealService } from './services/EtherealService';
import { EtherealWebSocketClient } from './services/EtherealWebSocketClient';
import { DeviationCheckService } from './services/DeviationCheckService';
import { loadConfig, loadEtherealConfig, fetchProductInfo } from './config/marketConfig';

async function runMarketMaker() {
  console.log('Starting Market Making Bot...');

  // Load configuration
  const config = loadConfig();
  const etherealConfig = loadEtherealConfig();
  const subaccountId = process.env.ETHEREAL_SUBACCOUNT_ID;

  if (!subaccountId) {
    console.error('Please set ETHEREAL_SUBACCOUNT_ID in your .env file');
    return;
  }

  // Initialize services
  const hermesPriceClient = new HermesPriceClient({
    endpoint: process.env.HERMES_ENDPOINT || 'https://hermes.pyth.network',
    reconnectInterval: 5000,
    maxReconnectAttempts: 3
  });
  const snapshotManager = new PriceSnapshotService(config.quoteRefreshCycle);
  const etherealService = new EtherealService(etherealConfig);
  const deviationCheckService = new DeviationCheckService();

  // Set up WebSocket for order updates
  const wsClient = new EtherealWebSocketClient({
    endpoint: process.env.ETHEREAL_WS_URL || 'wss://ws.etherealtest.net/v1/stream',
    timeout: parseInt(process.env.ETHEREAL_TIMEOUT || '10000')
  });

  try {
    // Connect to order updates WebSocket
    console.log('Connecting to Ethereal WebSocket for order updates...');
    await wsClient.connect();

    wsClient.subscribeToOrderUpdates(subaccountId, (orderUpdate) => {
      console.log(`[ORDER UPDATE] ${orderUpdate.id}: ${orderUpdate.status}`);
      snapshotManager.updateOrderStatus(orderUpdate);
    });

    // Wire up services
    snapshotManager.setDeviationCheckService(deviationCheckService);
    snapshotManager.setEtherealService(etherealService);

    // Fetch product info and set up asset configurations
    console.log('Fetching product information for assets...');
    for (const asset of config.assets) {
      const productInfo = await fetchProductInfo(asset.ticker);
      const enhancedAsset = {
        ...asset,
        tickSize: productInfo.tickSize,
        minQuantity: productInfo.minQuantity,
        maxQuantity: productInfo.maxQuantity,
        productId: productInfo.productId
      };
      snapshotManager.setAssetConfig(asset.ticker, enhancedAsset);
      console.log(`${asset.ticker}: tickSize=${productInfo.tickSize}, minQuantity=${productInfo.minQuantity}, maxQuantity=${productInfo.maxQuantity}, productId=${productInfo.productId}`);
    }

    // Load existing positions
    await snapshotManager.loadExistingPositions(subaccountId);

    // Subscribe to price updates
    hermesPriceClient.onPriceUpdate((priceUpdate) => {
      snapshotManager.updatePrice(priceUpdate);
    });

    // Set up snapshot callback for logging
    snapshotManager.onSnapshot((snapshot) => {
      const timestamp = new Date(snapshot.timestamp).toISOString();
      const assetConfig = config.assets.find(a => a.ticker === snapshot.ticker);
      if (assetConfig) {
        console.log(`[${timestamp}] ${snapshot.ticker}: $${snapshot.price.toFixed(2)} (size: ${assetConfig.orderSize})`);
      }
    });

    // Start price feed connections
    const tickers = config.assets.map(asset => asset.ticker);

    console.log('Connecting to Hermes price feeds...');
    await hermesPriceClient.connect();
    await hermesPriceClient.subscribe(tickers);

    // Start snapshot manager
    snapshotManager.start();

    console.log('Market making bot is running...');
    console.log(`Assets: ${config.assets.map(a => a.ticker).join(', ')}`);
    console.log(`Quote refresh cycle: ${config.quoteRefreshCycle}ms`);

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}, shutting down market making bot...`);

      // Stop creating new orders
      snapshotManager.stop();

      // Cancel all active orders
      await snapshotManager.cancelAllActiveOrders();

      // Disconnect from services
      hermesPriceClient.disconnect();
      wsClient.disconnect();

      console.log('Market making bot shutdown complete');
      process.exit(0);
    };

    // Handle different termination signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));

  } catch (error) {
    console.error('Error starting market making bot:', error);
    wsClient.disconnect();
    hermesPriceClient.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  runMarketMaker();
}