import { WSMessage } from '@/types';
import { authService } from './auth';

type MessageHandler = (msg: WSMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private token: string | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectInterval: number | null = null;
  private usePollingFallback = false;
  private pollInterval: number | null = null;
  private pollMetrics: (() => Promise<void>) | null = null;
  private pollLogs: (() => Promise<void>) | null = null;
  private lastLogId: number = 0;

  connect(pollMetricsFn?: () => Promise<void>, pollLogsFn?: () => Promise<void>) {
    this.token = authService.getToken();
    if (!this.token) {
      console.warn('No admin token, cannot connect WebSocket');
      return;
    }

    const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const wsBase = base.replace(/^http/, 'ws');
    this.url = `${wsBase}/ws?token=${this.token}`;
    this.pollMetrics = pollMetricsFn || null;
    this.pollLogs = pollLogsFn || null;

    this.attemptConnect();
  }

  private attemptConnect() {
    if (!this.url) return;
    try {
      this.ws = new WebSocket(this.url);
      this.usePollingFallback = false;

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.scheduleReconnect(null);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          this.handlers.forEach((h) => h(msg));
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error', err);
        this.ws?.close();
      };
    } catch (err) {
      console.error('Failed to create WebSocket', err);
      this.usePollingFallback = true;
      this.startPollingFallback();
    }
  }

  private scheduleReconnect(delay: number = 5000) {
    if (this.reconnectInterval) clearTimeout(this.reconnectInterval);
    this.reconnectInterval = setTimeout(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        this.attemptConnect();
      }
    }, delay);
  }

  private startPollingFallback() {
    if (this.pollMetrics) {
      this.pollInterval = setInterval(async () => {
        try {
          await this.pollMetrics!();
        } catch (e) {
          console.error('Polling error', e);
        }
      }, 1000);
    }
    // For logs, we rely on the hook to poll separately because we need to track lastLogId.
  }

  disconnect() {
    if (this.reconnectInterval) clearTimeout(this.reconnectInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.ws?.close();
    this.ws = null;
    this.handlers = [];
  }

  subscribe(handler: MessageHandler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  // Send a message to WebSocket (if connected)
  send(msg: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  isUsingPolling(): boolean {
    return this.usePollingFallback;
  }
}

export const wsService = new WebSocketService();