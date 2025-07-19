// WebSocket Service for real-time communication
export interface WebSocketMessage {
  type: string;
  payload: any;
  terminalId?: string;
  timestamp?: string;
}

export interface PriceRequest {
  productId: string;
  barcode: string;
}

export interface PriceResponse {
  productId: string;
  barcode: string;
  price: number;
  available: boolean;
}

export interface InventoryChange {
  productId: string;
  oldQuantity: number;
  newQuantity: number;
  reason: string;
}

export interface TerminalStatus {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  lastActivity: string;
  userId?: string;
  userRole?: string;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private terminalId: string | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.connect();
  }

  connect() {
    try {
      // Use environment variable or default to the correct URL
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
      console.log('Connecting to WebSocket:', wsUrl); // Add this line for debugging
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  private handleOpen() {
    console.log('WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    
    this.emit('connected', {});
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.handleIncomingMessage(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleClose(event: CloseEvent) {
    console.log('WebSocket disconnected:', event.code, event.reason);
    this.isConnected = false;
    this.terminalId = null;
    
    this.emit('disconnected', { code: event.code, reason: event.reason });
    
    // Don't reconnect if it was a clean close
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Event) {
    console.error('WebSocket error:', error);
    this.emit('error', error);
  }

  private handleIncomingMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'connection_ack':
        this.terminalId = message.payload.terminalId;
        console.log('Terminal ID assigned:', this.terminalId);
        this.emit('terminal_assigned', message.payload);
        break;

      case 'price_response':
        this.emit('price_response', message.payload as PriceResponse);
        break;

      case 'inventory_changed':
        this.emit('inventory_changed', message.payload as InventoryChange);
        break;

      case 'terminal_status':
        this.emit('terminal_status', message.payload as TerminalStatus);
        break;

      case 'transaction_sync':
        this.emit('transaction_sync', message.payload);
        break;

      case 'employee_action':
        this.emit('employee_action', message.payload);
        break;

      default:
        console.log('Unknown message type:', message.type, message.payload);
        this.emit('unknown_message', message);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('max_reconnect_attempts_reached', {});
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, delay);
  }

  // Public methods
  send(type: string, payload: any) {
    if (!this.isConnected || !this.ws) {
      console.warn('WebSocket not connected. Message queued:', type, payload);
      return false;
    }

    const message: WebSocketMessage = {
      type,
      payload,
      terminalId: this.terminalId || undefined,
      timestamp: new Date().toISOString()
    };

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  // Specific message types
  requestPrice(productId: string, barcode: string): boolean {
    return this.send('price_request', { productId, barcode });
  }

  reportInventoryChange(productId: string, oldQuantity: number, newQuantity: number, reason: string): boolean {
    return this.send('inventory_change', { productId, oldQuantity, newQuantity, reason });
  }

  syncTransaction(transactionData: any): boolean {
    return this.send('transaction_sync', transactionData);
  }

  updateTerminalStatus(status: 'active' | 'inactive'): boolean {
    return this.send('terminal_status_update', { status });
  }

  // Event listeners
  on(eventType: string, callback: Function) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  off(eventType: string, callback: Function) {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(eventType: string, data: any) {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket event callback:', error);
        }
      });
    }
  }

  // Connection status
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getTerminalId(): string | null {
    return this.terminalId;
  }

  // Cleanup
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isConnected = false;
    this.terminalId = null;
    this.listeners.clear();
  }
}

// Create and export a singleton instance
export const wsService = new WebSocketService();
export default wsService;
