/**
 * ResilientWebSocket.ts
 * Enterprise resilient WebSocket transport with exponential backoff, decorrelated jitter,
 * automated heartbeat ping/pong, and an offline audio packet replay queue.
 */

export interface WebSocketConfig {
  url: string;
  heartbeatIntervalMs?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  maxQueuedMessages?: number;
}

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

export class ResilientWebSocketClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'DISCONNECTED';
  private reconnectAttempts = 0;
  private heartbeatTimer: any = null;
  private offlineQueue: string[] = [];

  private listeners = new Map<string, Set<(data: any) => void>>();

  constructor(private config: WebSocketConfig) {}

  /**
   * Connects to WebSocket endpoint with automatic reconnect handlers
   */
  public connect(): void {
    if (this.state === 'CONNECTED' || this.state === 'CONNECTING') return;

    this.setState('CONNECTING');
    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setState('CONNECTED');
        this.startHeartbeat();
        this.flushOfflineQueue();
        this.emit('open', { url: this.config.url });
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'PONG') return;
          this.emit('message', parsed);
        } catch {
          this.emit('message', event.data);
        }
      };

      this.ws.onclose = () => {
        this.cleanup();
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        this.emit('error', err);
        this.ws?.close();
      };
    } catch (err) {
      this.scheduleReconnect();
    }
  }

  /**
   * Calculates exponential backoff with full jitter (decorrelated jitter)
   */
  public calculateNextBackoff(): number {
    const base = this.config.initialBackoffMs ?? 500;
    const max = this.config.maxBackoffMs ?? 15000;
    const exp = Math.min(max, base * Math.pow(2, this.reconnectAttempts));
    const jitter = Math.random() * exp * 0.4;
    return Math.floor(exp + jitter);
  }

  private scheduleReconnect(): void {
    this.setState('RECONNECTING');
    const delay = this.calculateNextBackoff();
    this.reconnectAttempts++;
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delayMs: delay });

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Sends data over socket. If disconnected, queues message safely up to limit.
   */
  public send(data: any): boolean {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(serialized);
      return true;
    }

    const maxQueue = this.config.maxQueuedMessages ?? 200;
    if (this.offlineQueue.length < maxQueue) {
      this.offlineQueue.push(serialized);
    }
    return false;
  }

  private flushOfflineQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.offlineQueue.length > 0) {
      const msg = this.offlineQueue.shift();
      if (msg) this.ws.send(msg);
    }
  }

  private startHeartbeat(): void {
    const interval = this.config.heartbeatIntervalMs ?? 15000;
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
      }
    }, interval);
  }

  private cleanup(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.ws = null;
  }

  public disconnect(): void {
    this.cleanup();
    this.reconnectAttempts = 0;
    this.setState('DISCONNECTED');
    if (this.ws) {
      (this.ws as any).close();
    }
  }

  public on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public off(event: string, callback: (data: any) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.emit('stateChange', state);
  }

  public get connectionState(): ConnectionState {
    return this.state;
  }

  public get queueLength(): number {
    return this.offlineQueue.length;
  }
}
