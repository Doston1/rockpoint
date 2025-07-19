import { useCallback, useEffect, useState } from 'react';
import type { InventoryChange, PriceResponse, TerminalStatus } from '../services/websocket';
import { wsService } from '../services/websocket';

export interface UseWebSocketReturn {
  isConnected: boolean;
  terminalId: string | null;
  requestPrice: (productId: string, barcode: string) => boolean;
  reportInventoryChange: (productId: string, oldQuantity: number, newQuantity: number, reason: string) => boolean;
  syncTransaction: (transactionData: any) => boolean;
  updateTerminalStatus: (status: 'active' | 'inactive') => boolean;
  onPriceResponse: (callback: (data: PriceResponse) => void) => () => void;
  onInventoryChanged: (callback: (data: InventoryChange) => void) => () => void;
  onTerminalStatus: (callback: (data: TerminalStatus) => void) => () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [terminalId, setTerminalId] = useState<string | null>(null);

  useEffect(() => {
    // Set up event listeners
    const handleConnected = () => {
      setIsConnected(true);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setTerminalId(null);
    };

    const handleTerminalAssigned = (data: { terminalId: string }) => {
      setTerminalId(data.terminalId);
    };

    const handleError = (error: any) => {
      console.error('WebSocket error:', error);
    };

    // Register event listeners
    wsService.on('connected', handleConnected);
    wsService.on('disconnected', handleDisconnected);
    wsService.on('terminal_assigned', handleTerminalAssigned);
    wsService.on('error', handleError);

    // Initial connection status
    setIsConnected(wsService.getConnectionStatus());
    setTerminalId(wsService.getTerminalId());

    // Cleanup function
    return () => {
      wsService.off('connected', handleConnected);
      wsService.off('disconnected', handleDisconnected);
      wsService.off('terminal_assigned', handleTerminalAssigned);
      wsService.off('error', handleError);
    };
  }, []);

  const requestPrice = useCallback((productId: string, barcode: string): boolean => {
    return wsService.requestPrice(productId, barcode);
  }, []);

  const reportInventoryChange = useCallback((productId: string, oldQuantity: number, newQuantity: number, reason: string): boolean => {
    return wsService.reportInventoryChange(productId, oldQuantity, newQuantity, reason);
  }, []);

  const syncTransaction = useCallback((transactionData: any): boolean => {
    return wsService.syncTransaction(transactionData);
  }, []);

  const updateTerminalStatus = useCallback((status: 'active' | 'inactive'): boolean => {
    return wsService.updateTerminalStatus(status);
  }, []);

  // Event listener registration functions
  const onPriceResponse = useCallback((callback: (data: PriceResponse) => void) => {
    wsService.on('price_response', callback);
    
    // Return cleanup function
    return () => {
      wsService.off('price_response', callback);
    };
  }, []);

  const onInventoryChanged = useCallback((callback: (data: InventoryChange) => void) => {
    wsService.on('inventory_changed', callback);
    
    // Return cleanup function
    return () => {
      wsService.off('inventory_changed', callback);
    };
  }, []);

  const onTerminalStatus = useCallback((callback: (data: TerminalStatus) => void) => {
    wsService.on('terminal_status', callback);
    
    // Return cleanup function
    return () => {
      wsService.off('terminal_status', callback);
    };
  }, []);

  return {
    isConnected,
    terminalId,
    requestPrice,
    reportInventoryChange,
    syncTransaction,
    updateTerminalStatus,
    onPriceResponse,
    onInventoryChanged,
    onTerminalStatus,
  };
}
