// GrpcWebTransport — implements MessagingTransport over the chat.proto ChatService
//
// Wire: WebSocket → Envoy → gRPC (bidirectional stream via StreamMessages RPC)
// Message format: JSON (Envoy JSON transcoding — bytes fields as base64 strings)
//
// Field mapping:
//   ClientMessage.token             ← Supabase JWT
//   ClientMessage.receiver_id       ← envelope.recipientId
//   ClientMessage.encrypted_payload ← envelope.ciphertextB64
//   ClientMessage.message_type      ← "text"
//   ClientMessage.ratchet_key       ← envelope.dhHeaderB64 (JSON: {dhPub,n,pn})
//
//   ServerMessage.sender_id         → envelope.senderId
//   ServerMessage.encrypted_payload → envelope.ciphertextB64
//   ServerMessage.ratchet_key       → envelope.dhHeaderB64 (parse n,pn from JSON)
//   ServerMessage.timestamp         → envelope.timestamp  (int64 ms → ISO string)

import type { MessageHandler, StatusHandler } from './messaging-bridge';
import type { MessageEnvelope } from './types';
import type { ClientMessage, ServerMessage } from './proto/chat';

export class GrpcWebTransport {
  private ws:          WebSocket | null = null;
  private _onMessage:  MessageHandler  | null = null;
  private _onStatus:   StatusHandler   | null = null;
  private _pingTimer:  ReturnType<typeof setInterval> | null = null;
  private _pingStart   = 0;
  private _token       = '';
  private _userId      = '';

  constructor(private readonly url: string) {}

  /** Call before connect() to supply the Supabase auth token. */
  setToken(token: string) { this._token = token; }

  connect(userId: string, onMessage: MessageHandler, onStatus: StatusHandler) {
    this._userId    = userId;
    this._onMessage = onMessage;
    this._onStatus  = onStatus;

    onStatus('connecting');

    // Envoy exposes gRPC-Web over WebSocket — swap http(s) → ws(s)
    const wsUrl = this.url.replace(/^https?/, match => match === 'https' ? 'wss' : 'ws');
    this.ws = new WebSocket(`${wsUrl}?userId=${encodeURIComponent(userId)}`);

    this.ws.onopen = () => {
      onStatus('connected', 0);
      this._pingTimer = setInterval(() => this._ping(), 5000);
    };

    this.ws.onclose = () => {
      if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
      onStatus('disconnected');
    };

    this.ws.onerror = () => onStatus('error');

    this.ws.onmessage = (ev: MessageEvent) => {
      if (ev.data === 'pong') {
        onStatus('connected', Date.now() - this._pingStart);
        return;
      }
      try {
        const msg: ServerMessage = JSON.parse(ev.data as string);
        onMessage(this._toEnvelope(msg));
      } catch (e) {
        console.error('[GrpcWebTransport] Failed to parse ServerMessage:', e);
      }
    };
  }

  async send(envelope: MessageEnvelope): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('[GrpcWebTransport] Not connected');
    }
    const msg: ClientMessage = {
      token:             this._token,
      receiver_id:       envelope.recipientId,
      encrypted_payload: envelope.ciphertextB64,
      message_type:      'text',
      ratchet_key:       envelope.dhHeaderB64,
    };
    this.ws.send(JSON.stringify(msg));
  }

  disconnect() {
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
    this.ws?.close();
    this.ws = null;
  }

  isConnected() { return this.ws?.readyState === WebSocket.OPEN; }

  // ── Private ──────────────────────────────────────────────────────────────

  private _ping() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this._pingStart = Date.now();
      this.ws.send('ping');
    }
  }

  /** Map a ServerMessage (proto fields) → internal MessageEnvelope */
  private _toEnvelope(msg: ServerMessage): MessageEnvelope {
    // The ratchet_key is dhHeaderB64 = base64(JSON.stringify({ dhPub, n, pn }))
    // Extract n (msgNum) and pn (prevChainLen) so decryptInbound works correctly.
    let msgNum = 0;
    let prevChainLen = 0;
    try {
      const header = JSON.parse(atob(msg.ratchet_key)) as { n?: number; pn?: number };
      msgNum       = header.n  ?? 0;
      prevChainLen = header.pn ?? 0;
    } catch { /* ratchet_key may be raw key bytes on first message — safe to ignore */ }

    const tsMs   = Number(msg.timestamp);
    const convId = [this._userId, msg.sender_id].sort().join(':');

    return {
      id:                `${msg.sender_id}-${msg.timestamp}`,
      conversationId:    convId,
      senderId:          msg.sender_id,
      recipientId:       this._userId,
      ciphertextB64:     msg.encrypted_payload,
      dhHeaderB64:       msg.ratchet_key,
      msgNum,
      prevChainLen,
      timestamp:         Number.isFinite(tsMs) ? new Date(tsMs).toISOString() : new Date().toISOString(),
    };
  }
}
