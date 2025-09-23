import 'dotenv/config';
import { EtherealService } from '../services/EtherealService';
import { EtherealWebSocketClient } from '../services/EtherealWebSocketClient';
import { loadEtherealConfig } from '../config/marketConfig';
import { CreateOrderRequest, CancelOrderRequest } from '../types/orders';
import { generateExpiresAt, convertSideToNumber } from '../utils/orderUtils';

async function runCancelOrderExample() {
  const config = loadEtherealConfig();
  const subaccountId = process.env.ETHEREAL_SUBACCOUNT_ID;
  const subaccount = process.env.ETHEREAL_SUBACCOUNT;

  if (!subaccountId || subaccountId === 'your-subaccount-id-here') {
    console.error('Please set ETHEREAL_SUBACCOUNT_ID in your .env file');
    return;
  }

  if (!subaccount) {
    console.error('Please set ETHEREAL_SUBACCOUNT in your .env file');
    return;
  }

  const etherealService = new EtherealService(config);

  // Optional: Set up WebSocket to monitor order updates
  const wsClient = new EtherealWebSocketClient({
    endpoint: process.env.ETHEREAL_WS_URL || 'wss://ws.etherealtest.net/v1/stream',
    timeout: parseInt(process.env.ETHEREAL_TIMEOUT || '10000')
  });

  try {
    // Connect to WebSocket for order monitoring
    console.log('Connecting to WebSocket for order updates...');
    await wsClient.connect();

    wsClient.subscribeToOrderUpdates(subaccountId, (orderUpdate) => {
      console.log(`[ORDER UPDATE] ${orderUpdate.id}: ${orderUpdate.status}`);
    });

    // Create a buy order first
    const buyOrder: CreateOrderRequest = {
      order_type: 'LIMIT',
      quantity: 0.001,
      side: convertSideToNumber('BUY'),
      price: 110000, // Below market to avoid immediate fill
      ticker: 'BTCUSD',
      time_in_force: 'GTD',
      expires_at: generateExpiresAt(10) // Expires in 10 minutes
    };

    console.log('\n1. Creating buy order...');
    console.log(JSON.stringify(buyOrder, null, 2));

    const orderResponse = await etherealService.placeOrder(buyOrder);
    console.log('Order created:', orderResponse);

    // Extract order ID from response
    const orderId = orderResponse.order.id;

    if (!orderId) {
      console.error('Could not extract order ID from response');
      return;
    }

    console.log(`\n2. Order ID: ${orderId}`);

    // Wait a bit to see the order in the system
    console.log('Waiting 3 seconds before cancelling...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Cancel the order
    const cancelRequest: CancelOrderRequest = {
      order_ids: [orderId],
      subaccount: subaccount
    };

    console.log('\n3. Cancelling order...');
    console.log(JSON.stringify(cancelRequest, null, 2));

    const cancelResponse = await etherealService.cancelOrder(cancelRequest);
    console.log('Cancel response:', cancelResponse);

    // Wait to see the cancellation update
    console.log('\nWaiting for order update confirmation...');
    setTimeout(() => {
      wsClient.disconnect();
      console.log('Example completed');
    }, 3000);

  } catch (error) {
    console.error('Error in cancel order example:', error);
    wsClient.disconnect();
  }
}

if (require.main === module) {
  runCancelOrderExample();
}