// Abstract transport layer — plug in WebSocket, SSE, or gRPC-Web by implementing MessagingTransport.
// Factory auto-selects: GrpcWebTransport (NEXT_PUBLIC_GRPC_URL) → WebSocketTransport (NEXT_PUBLIC_BACKEND_WS_URL) → DemoTransport.
import { GrpcWebTransport } from './grpc-transport';
import type { MessageEnvelope } from './types';

export type MessageHandler = (envelope: MessageEnvelope) => void;
export type StatusHandler  = (status: 'connected' | 'disconnected' | 'connecting' | 'error', latencyMs?: number) => void;

export interface MessagingTransport {
  connect(userId: string, onMessage: MessageHandler, onStatus: StatusHandler): void;
  disconnect(): void;
  send(envelope: MessageEnvelope): Promise<void>;
  isConnected(): boolean;
  /** Optional — provide the Supabase JWT so the transport can authenticate with the server. */
  setToken?(token: string): void;
}

// ─── Demo Transport ───────────────────────────────────────────────────────

export class DemoTransport implements MessagingTransport {
  private _connected = false;
  private _onMessage: MessageHandler | null = null;
  private _onStatus:  StatusHandler  | null = null;
  private _pingTimer: ReturnType<typeof setInterval> | null = null;

  connect(_userId: string, onMessage: MessageHandler, onStatus: StatusHandler) {
    this._onMessage = onMessage;
    this._onStatus  = onStatus;

    onStatus('connecting');
    setTimeout(() => {
      this._connected = true;
      onStatus('connected', 44);
    }, 900);

    // Simulate periodic latency pings
    this._pingTimer = setInterval(() => {
      if (this._connected) {
        onStatus('connected', Math.floor(Math.random() * 25) + 32);
      }
    }, 4000);
  }

  disconnect() {
    this._connected = false;
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
    this._onStatus?.('disconnected');
  }

  async send(envelope: MessageEnvelope) {
    if (!this._connected) throw new Error('[DemoTransport] Not connected');
    console.debug('[DemoTransport] Outbound envelope', envelope.id);
    // Echo back after a delay (simulates real round-trip for demo)
    await new Promise(r => setTimeout(r, 120));
  }

  isConnected() { return this._connected; }

  /** Call this to inject a simulated inbound message (for demo/testing). */
  simulateInbound(envelope: MessageEnvelope) {
    this._onMessage?.(envelope);
  }
}

// ─── WebSocket Transport ──────────────────────────────────────────────────

export class WebSocketTransport implements MessagingTransport {
  private ws: WebSocket | null = null;
  private _onMessage: MessageHandler | null = null;
  private _onStatus:  StatusHandler  | null = null;
  private _pingStart = 0;
  private _pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly url: string) {}

  connect(userId: string, onMessage: MessageHandler, onStatus: StatusHandler) {
    this._onMessage = onMessage;
    this._onStatus  = onStatus;

    onStatus('connecting');
    this.ws = new WebSocket(`${this.url}?userId=${encodeURIComponent(userId)}`);

    this.ws.onopen = () => {
      onStatus('connected');
      this._pingTimer = setInterval(() => this._ping(), 5000);
    };
    this.ws.onclose = () => {
      onStatus('disconnected');
      if (this._pingTimer) clearInterval(this._pingTimer);
    };
    this.ws.onerror = () => onStatus('error');
    this.ws.onmessage = (ev) => {
      if (ev.data === 'pong') {
        onStatus('connected', Date.now() - this._pingStart);
        return;
      }
      try {
        const envelope: MessageEnvelope = JSON.parse(ev.data as string);
        onMessage(envelope);
      } catch (e) {
        console.error('[WSTransport] Bad message', e);
      }
    };
  }

  private _ping() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this._pingStart = Date.now();
      this.ws.send('ping');
    }
  }

  disconnect() {
    if (this._pingTimer) clearInterval(this._pingTimer);
    this.ws?.close();
    this.ws = null;
  }

  async send(envelope: MessageEnvelope) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('[WSTransport] Not connected');
    }
    this.ws.send(JSON.stringify(envelope));
  }

  isConnected() { return this.ws?.readyState === WebSocket.OPEN; }
}

// ─── Factory ──────────────────────────────────────────────────────────────

export function createTransport(): MessagingTransport {
  const grpcUrl = process.env.NEXT_PUBLIC_GRPC_URL;
  if (grpcUrl) return new GrpcWebTransport(grpcUrl);
  const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL;
  if (wsUrl) return new WebSocketTransport(wsUrl);
  return new DemoTransport();
}
