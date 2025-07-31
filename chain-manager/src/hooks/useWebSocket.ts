import { useCallback, useEffect, useState } from 'react';
import type { WebSocketMessage } from '../services/websocket';
import { webSocketService } from '../services/websocket';

export interface UseWebSocketReturn {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: WebSocketMessage) => void;
  lastMessage: WebSocketMessage | null;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    setLastMessage(message);
  }, []);

  const handleConnection = useCallback((connected: boolean) => {
    setIsConnected(connected);
  }, []);

  useEffect(() => {
    // Add listeners
    webSocketService.addMessageListener(handleMessage);
    webSocketService.addConnectionListener(handleConnection);

    // Set initial connection state
    setIsConnected(webSocketService.isConnected());

    // Cleanup function
    return () => {
      webSocketService.removeMessageListener(handleMessage);
      webSocketService.removeConnectionListener(handleConnection);
    };
  }, [handleMessage, handleConnection]);

  const connect = useCallback(() => {
    webSocketService.connect();
  }, []);

  const disconnect = useCallback(() => {
    webSocketService.disconnect();
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    webSocketService.sendMessage(message);
  }, []);

  return {
    isConnected,
    connect,
    disconnect,
    sendMessage,
    lastMessage,
  };
};
