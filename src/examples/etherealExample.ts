import 'dotenv/config';
import { EtherealService } from '../services/EtherealService';
import { loadEtherealConfig } from '../config/marketConfig';
import { CreateOrderRequest, CancelOrderRequest } from '../types/orders';
import { generateClientOrderId, generateExpiresAt, convertSideToNumber } from '../utils/orderUtils';

async function runEtherealExample() {
  const config = loadEtherealConfig();
  const etherealService = new EtherealService(config);

  console.log('Testing Ethereal Service...');

  try {
    // Create a sample buy order
    const buyOrder: CreateOrderRequest = {
      order_type: 'LIMIT',
      quantity: 0.001,
      side: convertSideToNumber('BUY'),
      price: 112400.15,
      ticker: 'BTCUSD',
      time_in_force: 'GTD',
      expires_at: generateExpiresAt(5) // Expires in 60 minutes
    };

    console.log('Creating buy order:');
    console.log(JSON.stringify(buyOrder, null, 2));

    const buyResponse = await etherealService.placeOrder(buyOrder);
    console.log('Order created successfully:', buyResponse);

  } catch (error) {
    console.error('Error in Ethereal example:', error);
  }
}

if (require.main === module) {
  runEtherealExample();
}