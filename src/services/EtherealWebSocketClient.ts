import { io, Socket } from 'socket.io-client';
import { IOrderUpdateClient } from '../interfaces/IOrderUpdateClient';
import {
  OrderUpdateSubscription,
  OrderUpdateEvent,
  OrderFillEvent,
  OrderUpdateCallback,
  OrderFillCallback,
  WebSocketStatusCallback
} from '../types/orderUpdates';

/**
 * Configuration for Ethereal WebSocket client connection
 */
export interface EtherealWebSocketConfig {
  /** Ethereal WebSocket endpoint URL */
  endpoint: string;
  /** Connection timeout in milliseconds (default: 5000) */
  timeout?: number;
}

/**
 * Ethereal WebSocket client for real-time order and fill updates
 *
 * Provides real-time notifications for order status changes and trade executions
 * on the Ethereal perpetual futures exchange. Uses Socket.IO for reliable
 * WebSocket communication with automatic reconnection and event handling.
 *
 * Critical for Market Making:
 * - Immediate notification when orders are filled (prevents over-positioning)
 * - Real-time order status updates (NEW -> FILLED, cancellations, etc.)
 * - Trade execution details for P&L tracking and position management
 * - Connection status monitoring for system reliability
 *
 * Key Features:
 * - Socket.IO based WebSocket connection with auto-reconnect
 * - Per-subaccount subscription management
 * - Separate callbacks for order updates vs. fill events
 * - Connection lifecycle management and status reporting
 * - Graceful error handling and event processing
 *
 * Event Types:
 * - Order Updates: Status changes (NEW, PARTIALLY_FILLED, FILLED, CANCELED)
 * - Fill Events: Trade execution details (price, quantity, fees)
 * - Connection Events: Connect, disconnect, error notifications
 */
export class EtherealWebSocketClient implements IOrderUpdateClient {
  private socket?: Socket;
  private config: EtherealWebSocketConfig;
  private connectionStatusCallback?: WebSocketStatusCallback;
  private orderUpdateCallbacks: Map<string, OrderUpdateCallback> = new Map();
  private orderFillCallbacks: Map<string, OrderFillCallback> = new Map();
  private isSocketConnected = false;

  constructor(config: EtherealWebSocketConfig) {
    this.config = config;
  }

  public onConnectionStatus(callback: WebSocketStatusCallback): void {
    this.connectionStatusCallback = callback;
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.config.endpoint, {
          transports: ['websocket'], // Only use websocket as recommended
          timeout: this.config.timeout || 10000
        });

        this.socket.on('connect', () => {
          this.isSocketConnected = true;
          this.connectionStatusCallback?.('connected');
          console.log('Connected to Ethereal WebSocket');
          resolve();
        });

        this.socket.on('disconnect', () => {
          this.isSocketConnected = false;
          this.connectionStatusCallback?.('disconnected');
          console.log('Disconnected from Ethereal WebSocket');
        });

        this.socket.on('connect_error', (error) => {
          this.isSocketConnected = false;
          this.connectionStatusCallback?.('error', error);
          console.error('Ethereal WebSocket connection error:', error);
          reject(error);
        });

        // Set up order update listeners
        this.socket.on('OrderUpdate', (data: OrderUpdateEvent) => {
          this.handleOrderUpdate(data);
        });

        this.socket.on('OrderFill', (data: OrderFillEvent) => {
          this.handleOrderFill(data);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
      this.isSocketConnected = false;
      this.orderUpdateCallbacks.clear();
      this.orderFillCallbacks.clear();
      console.log('Disconnected from Ethereal WebSocket');
    }
  }

  public subscribeToOrderUpdates(subaccountId: string, callback: OrderUpdateCallback): void {
    if (!this.socket || !this.isSocketConnected) {
      throw new Error('WebSocket not connected');
    }

    this.orderUpdateCallbacks.set(subaccountId, callback);

    const subscription: OrderUpdateSubscription = {
      type: 'OrderUpdate',
      subaccountId
    };

    this.socket.emit('subscribe', subscription);
    console.log(`Subscribed to OrderUpdate for subaccount: ${subaccountId}`);
  }

  public subscribeToOrderFills(subaccountId: string, callback: OrderFillCallback): void {
    if (!this.socket || !this.isSocketConnected) {
      throw new Error('WebSocket not connected');
    }

    this.orderFillCallbacks.set(subaccountId, callback);

    const subscription: OrderUpdateSubscription = {
      type: 'OrderFill',
      subaccountId
    };

    this.socket.emit('subscribe', subscription);
    console.log(`Subscribed to OrderFill for subaccount: ${subaccountId}`);
  }

  public unsubscribeFromOrderUpdates(subaccountId: string): void {
    this.orderUpdateCallbacks.delete(subaccountId);

    if (this.socket && this.isSocketConnected) {
      const subscription: OrderUpdateSubscription = {
        type: 'OrderUpdate',
        subaccountId
      };

      this.socket.emit('unsubscribe', subscription);
      console.log(`Unsubscribed from OrderUpdate for subaccount: ${subaccountId}`);
    }
  }

  public unsubscribeFromOrderFills(subaccountId: string): void {
    this.orderFillCallbacks.delete(subaccountId);

    if (this.socket && this.isSocketConnected) {
      const subscription: OrderUpdateSubscription = {
        type: 'OrderFill',
        subaccountId
      };

      this.socket.emit('unsubscribe', subscription);
      console.log(`Unsubscribed from OrderFill for subaccount: ${subaccountId}`);
    }
  }

  public isConnected(): boolean {
    return this.isSocketConnected;
  }

  private handleOrderUpdate(data: OrderUpdateEvent): void {
    this.orderUpdateCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in OrderUpdate callback:', error);
      }
    });
  }

  private handleOrderFill(data: OrderFillEvent): void {
    // Find the callback for the specific subaccount
    // Note: You'll need to extract subaccountId from the data when you know the format
    console.log('Received OrderFill:', data);

    // For now, call all registered callbacks
    this.orderFillCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in OrderFill callback:', error);
      }
    });
  }
}