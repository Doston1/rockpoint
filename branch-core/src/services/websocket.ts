import { v4 as uuidv4 } from 'uuid';
import { WebSocket, WebSocketServer } from 'ws';
import { RedisManager } from './redis';

export interface PosTerminal {
  id: string;
  name: string;
  ipAddress: string;
  status: 'online' | 'offline' | 'idle';
  connectedAt: Date;
  lastActivity: Date;
  userId?: string;
  userRole?: string;
}

export interface WSMessage {
  type: string;
  payload: any;
  timestamp: string;
  terminalId?: string;
}

export class WebSocketManager {
  private wsServer: WebSocketServer;
  private terminals: Map<string, { ws: WebSocket; terminal: PosTerminal }> = new Map();
  private messageHandlers: Map<string, (ws: WebSocket, message: WSMessage) => void> = new Map();

  constructor(wsServer: WebSocketServer) {
    this.wsServer = wsServer;
    this.setupMessageHandlers();
  }

  public initialize(): void {
    this.wsServer.on('connection', (ws: WebSocket, request) => {
      this.handleConnection(ws, request);
    });

    console.log('✅ WebSocket server initialized');
  }

  private handleConnection(ws: WebSocket, request: any): void {
    const terminalId = uuidv4();
    const ipAddress = request.socket.remoteAddress || 'unknown';
    
    const terminal: PosTerminal = {
      id: terminalId,
      name: `Terminal-${terminalId.slice(0, 8)}`,
      ipAddress,
      status: 'online',
      connectedAt: new Date(),
      lastActivity: new Date()
    };

    this.terminals.set(terminalId, { ws, terminal });
    
    console.log(`🔗 Terminal connected: ${terminalId} from ${ipAddress}`);

    // Send connection acknowledgment
    this.sendMessage(ws, {
      type: 'connection_ack',
      payload: { terminalId, message: 'Connected successfully' },
      timestamp: new Date().toISOString()
    });

    // Register terminal in Redis
    RedisManager.registerTerminal(terminalId, terminal).catch(console.error);

    // Set up message handler
    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, terminalId, data);
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(terminalId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for terminal ${terminalId}:`, error);
      this.handleDisconnection(terminalId);
    });

    // Set up ping/pong for connection health
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // Ping every 30 seconds

    ws.on('pong', () => {
      this.updateTerminalActivity(terminalId);
    });
  }

  private handleMessage(ws: WebSocket, terminalId: string, data: Buffer): void {
    try {
      const message: WSMessage = JSON.parse(data.toString());
      message.terminalId = terminalId;
      
      this.updateTerminalActivity(terminalId);
      
      console.log(`📨 Message from ${terminalId}:`, message.type);

      // Handle the message based on its type
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(ws, message);
      } else {
        console.warn(`⚠️ Unknown message type: ${message.type}`);
        this.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`❌ Failed to parse message from ${terminalId}:`, error);
      this.sendError(ws, 'Invalid message format');
    }
  }

  private handleDisconnection(terminalId: string): void {
    const terminalData = this.terminals.get(terminalId);
    if (terminalData) {
      terminalData.terminal.status = 'offline';
      this.terminals.delete(terminalId);
      console.log(`🔌 Terminal disconnected: ${terminalId}`);
      
      // Update Redis
      RedisManager.registerTerminal(terminalId, {
        ...terminalData.terminal,
        status: 'offline'
      }).catch(console.error);
    }
  }

  private updateTerminalActivity(terminalId: string): void {
    const terminalData = this.terminals.get(terminalId);
    if (terminalData) {
      terminalData.terminal.lastActivity = new Date();
      terminalData.terminal.status = 'online';
    }
  }

  private setupMessageHandlers(): void {
    // Terminal registration
    this.messageHandlers.set('register_terminal', (ws: WebSocket, message: WSMessage) => {
      const { name, capabilities } = message.payload;
      const terminalId = message.terminalId!;
      
      const terminalData = this.terminals.get(terminalId);
      if (terminalData) {
        terminalData.terminal.name = name || terminalData.terminal.name;
        
        this.sendMessage(ws, {
          type: 'registration_complete',
          payload: { terminalId, status: 'registered' },
          timestamp: new Date().toISOString()
        });
      }
    });

    // User login
    this.messageHandlers.set('user_login', (ws: WebSocket, message: WSMessage) => {
      const { userId, userRole } = message.payload;
      const terminalId = message.terminalId!;
      
      const terminalData = this.terminals.get(terminalId);
      if (terminalData) {
        terminalData.terminal.userId = userId;
        terminalData.terminal.userRole = userRole;
        
        this.sendMessage(ws, {
          type: 'login_success',
          payload: { userId, userRole },
          timestamp: new Date().toISOString()
        });

        // Broadcast to other terminals if needed
        this.broadcastToOthers(terminalId, {
          type: 'user_activity',
          payload: { action: 'login', userId, terminalId },
          timestamp: new Date().toISOString()
        });
      }
    });

    // Transaction updates
    this.messageHandlers.set('transaction_update', (ws: WebSocket, message: WSMessage) => {
      const { transactionId, status, items, total } = message.payload;
      
      // Broadcast transaction update to manager terminals
      this.broadcastToRole('manager', {
        type: 'transaction_update',
        payload: { transactionId, status, items, total, terminalId: message.terminalId },
        timestamp: new Date().toISOString()
      });
    });

    // Product price requests
    this.messageHandlers.set('price_request', (ws: WebSocket, message: WSMessage) => {
      const { productId, barcode } = message.payload;
      
      // This would typically fetch from database
      // For now, send a mock response
      this.sendMessage(ws, {
        type: 'price_response',
        payload: {
          productId,
          barcode,
          price: 10.99,
          name: 'Sample Product',
          available: true
        },
        timestamp: new Date().toISOString()
      });
    });

    // Inventory updates
    this.messageHandlers.set('inventory_update', (ws: WebSocket, message: WSMessage) => {
      const { productId, quantity, operation } = message.payload;
      
      // Broadcast inventory update to all terminals
      this.broadcast({
        type: 'inventory_changed',
        payload: { productId, quantity, operation },
        timestamp: new Date().toISOString()
      });
    });

    // Heartbeat/ping
    this.messageHandlers.set('ping', (ws: WebSocket, message: WSMessage) => {
      this.sendMessage(ws, {
        type: 'pong',
        payload: { timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString()
      });
    });
  }

  // Send message to specific WebSocket
  private sendMessage(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Send error message
  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      payload: { error },
      timestamp: new Date().toISOString()
    });
  }

  // Broadcast to all connected terminals
  public broadcast(message: WSMessage): void {
    this.terminals.forEach(({ ws }) => {
      this.sendMessage(ws, message);
    });
  }

  // Broadcast to all terminals except sender
  private broadcastToOthers(excludeTerminalId: string, message: WSMessage): void {
    this.terminals.forEach(({ ws }, terminalId) => {
      if (terminalId !== excludeTerminalId) {
        this.sendMessage(ws, message);
      }
    });
  }

  // Broadcast to terminals with specific user role
  private broadcastToRole(role: string, message: WSMessage): void {
    this.terminals.forEach(({ ws, terminal }) => {
      if (terminal.userRole === role) {
        this.sendMessage(ws, message);
      }
    });
  }

  // Send message to specific terminal
  public sendToTerminal(terminalId: string, message: WSMessage): void {
    const terminalData = this.terminals.get(terminalId);
    if (terminalData) {
      this.sendMessage(terminalData.ws, message);
    }
  }

  // Get all connected terminals
  public getConnectedTerminals(): PosTerminal[] {
    return Array.from(this.terminals.values()).map(({ terminal }) => terminal);
  }

  // Get terminal by ID
  public getTerminal(terminalId: string): PosTerminal | null {
    const terminalData = this.terminals.get(terminalId);
    return terminalData ? terminalData.terminal : null;
  }

  // Close all connections
  public closeAll(): void {
    this.terminals.forEach(({ ws }, terminalId) => {
      ws.close();
      this.handleDisconnection(terminalId);
    });
  }

  // Get connection statistics
  public getStats(): any {
    const terminals = Array.from(this.terminals.values()).map(({ terminal }) => terminal);
    
    return {
      totalConnections: this.terminals.size,
      onlineTerminals: terminals.filter(t => t.status === 'online').length,
      terminalsByRole: terminals.reduce((acc, terminal) => {
        const role = terminal.userRole || 'unknown';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}
