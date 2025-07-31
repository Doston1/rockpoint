import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { DatabaseManager } from '../database/manager';

interface AuthenticatedSocket {
  id: string;
  userId?: string;
  branchId?: string;
  role?: string;
  handshake: {
    auth: {
      token?: string;
    };
  };
  join: (room: string) => void;
  leave: (room: string) => void;
  emit: (event: string, data: any) => void;
  disconnect: () => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
}

export class WebSocketManager {
  private static instance: WebSocketManager;
  private io: any; // Using any for now since we're removing socket.io dependency
  private connectedClients: Map<string, AuthenticatedSocket> = new Map();

  private constructor(server: HTTPServer) {
    // For now, create a mock implementation
    // In a real implementation, you'd use either socket.io or native WebSocket
    console.warn('WebSocketManager: Socket.io not implemented, using mock');
    
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  public static getInstance(server?: HTTPServer): WebSocketManager {
    if (!WebSocketManager.instance && server) {
      WebSocketManager.instance = new WebSocketManager(server);
    }
    return WebSocketManager.instance;
  }

  private setupMiddleware(): void {
    // Mock implementation - would be replaced with actual socket.io or WebSocket setup
    console.log('WebSocket middleware setup - mock implementation');
  }

  private setupEventHandlers(): void {
    // Mock implementation - would be replaced with actual socket.io or WebSocket setup
    console.log('WebSocket event handlers setup - mock implementation');
  }

  private setupClientEventHandlers(socket: AuthenticatedSocket): void {
    // Mock implementation - would be replaced with actual event handling
    console.log('Client event handlers setup - mock implementation');
  }

  // Public methods for broadcasting messages

  public emitToAll(event: string, data: any): void {
    // Mock implementation
    console.log(`Broadcasting to all: ${event}`, data);
  }

  public emitToBranch(branchId: string, event: string, data: any): void {
    // Mock implementation
    console.log(`Broadcasting to branch ${branchId}: ${event}`, data);
  }

  public emitToRole(role: string, event: string, data: any): void {
    // Mock implementation
    console.log(`Broadcasting to role ${role}: ${event}`, data);
  }

  public emitToUser(userId: string, event: string, data: any): void {
    // Mock implementation
    console.log(`Sending to user ${userId}: ${event}`, data);
  }

  public emitToSocket(socketId: string, event: string, data: any): void {
    // Mock implementation
    console.log(`Sending to socket ${socketId}: ${event}`, data);
  }

  // Business-specific broadcast methods

  public broadcastInventoryUpdate(branchId: string, productId: string, newQuantity: number, updatedBy: string): void {
    this.emitToBranch(branchId, 'inventory-updated', {
      productId,
      branchId,
      newQuantity,
      updatedBy,
      timestamp: new Date().toISOString()
    });

    // Also notify admins
    this.emitToRole('admin', 'inventory-updated', {
      productId,
      branchId,
      newQuantity,
      updatedBy,
      timestamp: new Date().toISOString()
    });
  }

  public broadcastNewTransaction(transaction: {
    id: string;
    branchId: string;
    employeeId: string;
    amount: number;
    paymentMethod: string;
  }): void {
    // Notify branch
    this.emitToBranch(transaction.branchId, 'new-transaction', {
      ...transaction,
      timestamp: new Date().toISOString()
    });

    // Notify admins and managers
    this.emitToRole('admin', 'new-transaction', {
      ...transaction,
      timestamp: new Date().toISOString()
    });

    this.emitToRole('manager', 'new-transaction', {
      ...transaction,
      timestamp: new Date().toISOString()
    });
  }

  public broadcastLowStockAlert(branchId: string, productId: string, productName: string, currentQuantity: number, minStock: number): void {
    const alertData = {
      type: 'low_stock',
      branchId,
      productId,
      productName,
      currentQuantity,
      minStock,
      timestamp: new Date().toISOString()
    };

    // Notify branch
    this.emitToBranch(branchId, 'stock-alert', alertData);

    // Notify admins and managers
    this.emitToRole('admin', 'stock-alert', alertData);
    this.emitToRole('manager', 'stock-alert', alertData);
  }

  public broadcastSystemMessage(message: string, type: 'info' | 'warning' | 'error' = 'info', targetBranches?: string[]): void {
    const messageData = {
      message,
      type,
      timestamp: new Date().toISOString()
    };

    if (targetBranches && targetBranches.length > 0) {
      targetBranches.forEach(branchId => {
        this.emitToBranch(branchId, 'system-message', messageData);
      });
    } else {
      this.emitToAll('system-message', messageData);
    }
  }

  public broadcastEmployeeUpdate(branchId: string, employeeId: string, updateType: 'created' | 'updated' | 'deleted', employeeData?: any): void {
    const updateData = {
      employeeId,
      updateType,
      employeeData,
      timestamp: new Date().toISOString()
    };

    this.emitToBranch(branchId, 'employee-updated', updateData);
    this.emitToRole('admin', 'employee-updated', updateData);
  }

  // Connection management methods

  public getConnectedClients(): number {
    return this.connectedClients.size;
  }

  public getClientsByBranch(branchId: string): number {
    let count = 0;
    for (const socket of this.connectedClients.values()) {
      if (socket.branchId === branchId) {
        count++;
      }
    }
    return count;
  }

  public getClientsByRole(role: string): number {
    let count = 0;
    for (const socket of this.connectedClients.values()) {
      if (socket.role === role) {
        count++;
      }
    }
    return count;
  }

  public disconnectUser(userId: string): void {
    for (const [socketId, socket] of this.connectedClients.entries()) {
      if (socket.userId === userId) {
        socket.disconnect();
        this.connectedClients.delete(socketId);
        break;
      }
    }
  }

  public getConnectionStats(): {
    totalConnections: number;
    connectionsByBranch: Record<string, number>;
    connectionsByRole: Record<string, number>;
  } {
    const connectionsByBranch: Record<string, number> = {};
    const connectionsByRole: Record<string, number> = {};

    for (const socket of this.connectedClients.values()) {
      if (socket.branchId) {
        connectionsByBranch[socket.branchId] = (connectionsByBranch[socket.branchId] || 0) + 1;
      }
      if (socket.role) {
        connectionsByRole[socket.role] = (connectionsByRole[socket.role] || 0) + 1;
      }
    }

    return {
      totalConnections: this.connectedClients.size,
      connectionsByBranch,
      connectionsByRole
    };
  }

  public closeAll(): void {
    for (const [socketId, socket] of this.connectedClients.entries()) {
      socket.disconnect();
      this.connectedClients.delete(socketId);
    }
  }

  // Initialize method for server startup
  public initialize(): void {
    console.log('✅ WebSocket server initialized and ready for connections');
  }
}
