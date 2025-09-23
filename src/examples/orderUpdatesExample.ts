import 'dotenv/config';
import { EtherealWebSocketClient } from '../services/EtherealWebSocketClient';
import { IOrderUpdateClient } from '../interfaces/IOrderUpdateClient';
import { OrderUpdateEvent, OrderFillEvent } from '../types/orderUpdates';

async function runOrderUpdatesExample() {
  const subaccountId = process.env.ETHEREAL_SUBACCOUNT_ID;

  if (!subaccountId || subaccountId === 'your-subaccount-id-here') {
    console.error('Please set ETHEREAL_SUBACCOUNT_ID in your .env file');
    return;
  }

  const wsClient: IOrderUpdateClient = new EtherealWebSocketClient({
    endpoint: process.env.ETHEREAL_WS_URL || 'wss://ws.etherealtest.net/v1/stream',
    timeout: parseInt(process.env.ETHEREAL_TIMEOUT || '10000')
  });

  // Set up connection status handler
  wsClient.onConnectionStatus((status, error) => {
    console.log(`WebSocket status: ${status}`);
    if (error) {
      console.error('WebSocket error:', error.message);
    }
  });

  try {
    console.log('Connecting to Ethereal WebSocket...');
    await wsClient.connect();

    console.log('Setting up order update subscriptions...');

    // Subscribe to order updates
    wsClient.subscribeToOrderUpdates(subaccountId, (orderUpdate: OrderUpdateEvent) => {
      console.log('[ORDER UPDATE]', JSON.stringify(orderUpdate, null, 2));
    });

    // Subscribe to order fills
    wsClient.subscribeToOrderFills(subaccountId, (orderFill: OrderFillEvent) => {
      console.log('[ORDER FILL]', JSON.stringify(orderFill, null, 2));
    });

    console.log(`Listening for order updates for subaccount: ${subaccountId}`);
    console.log('Place some orders using the ethereal example to see updates...');
    console.log('Press Ctrl+C to stop');

    // Keep the process running
    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      wsClient.unsubscribeFromOrderUpdates(subaccountId);
      wsClient.unsubscribeFromOrderFills(subaccountId);
      wsClient.disconnect();
      process.exit(0);
    });

    // Keep alive
    setInterval(() => {
      if (!wsClient.isConnected()) {
        console.log('WebSocket disconnected, attempting to reconnect...');
        wsClient.connect().catch(console.error);
      }
    }, 30000); // Check every 30 seconds

  } catch (error) {
    console.error('Failed to connect to Ethereal WebSocket:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runOrderUpdatesExample();
}