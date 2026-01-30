/**
 * WebSocket utilities for real-time match updates
 * Handles connection, reconnection, and message parsing
 */

export interface WebSocketMessage {
  type: 'match_update' | 'odds_update' | 'stats_update' | 'connection' | 'error';
  data: any;
  timestamp: number;
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number; // ms between reconnection attempts
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export class LiveMatchWebSocket {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private reconnectAttempts = 0;
  private messageHandlers: Map<string, Function> = new Map();

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      onMessage: () => {},
      onConnect: () => {},
      onDisconnect: () => {},
      onError: () => {},
      ...config,
    };
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.reconnectAttempts = 0;
          this.config.onConnect();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('📨 WebSocket message:', message.type);

            // Call global handler
            this.config.onMessage(message);

            // Call type-specific handlers
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
              handler(message.data);
            }
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.config.onError(new Error('WebSocket error'));
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('⚠️ WebSocket disconnected');
          this.config.onDisconnect();
          this.attemptReconnect();
        };
      } catch (error) {
        this.config.onError(error as Error);
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `🔄 Reconnecting... (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`
      );

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('❌ Reconnection failed:', error);
        });
      }, this.config.reconnectInterval);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  /**
   * Subscribe to message type
   */
  public on(type: string, handler: Function): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Unsubscribe from message type
   */
  public off(type: string): void {
    this.messageHandlers.delete(type);
  }

  /**
   * Send message to server
   */
  public send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('❌ WebSocket not connected, cannot send message');
    }
  }

  /**
   * Subscribe to specific fixture updates
   */
  public subscribeToMatch(fixtureId: number): void {
    this.send({
      action: 'subscribe',
      fixtureId,
    });
  }

  /**
   * Unsubscribe from fixture updates
   */
  public unsubscribeFromMatch(fixtureId: number): void {
    this.send({
      action: 'unsubscribe',
      fixtureId,
    });
  }

  /**
   * Close connection
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

/**
 * Create a singleton WebSocket instance for your app
 */
let wsInstance: LiveMatchWebSocket | null = null;

export function getWebSocketInstance(config?: WebSocketConfig): LiveMatchWebSocket {
  if (!wsInstance && config) {
    wsInstance = new LiveMatchWebSocket(config);
  }
  return wsInstance!;
}

/**
 * Hook for React components to use WebSocket
 * Usage:
 * const { connect, disconnect, onMessage } = useWebSocket();
 * 
 * onMessage('match_update', (data) => {
 *   console.log('Match updated:', data);
 * });
 */
export function useWebSocket() {
  return {
    connect: async (url: string) => {
      const ws = getWebSocketInstance({
        url,
        onMessage: (msg) => console.log('Message:', msg),
      });
      return ws.connect();
    },
    disconnect: () => {
      wsInstance?.disconnect();
    },
    subscribe: (fixtureId: number) => {
      wsInstance?.subscribeToMatch(fixtureId);
    },
    unsubscribe: (fixtureId: number) => {
      wsInstance?.unsubscribeFromMatch(fixtureId);
    },
    onMessage: (type: string, handler: Function) => {
      wsInstance?.on(type, handler);
    },
    isConnected: () => wsInstance?.isConnected(),
  };
}
