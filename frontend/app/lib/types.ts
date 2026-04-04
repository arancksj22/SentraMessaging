// ─── Shared TypeScript types for SentraMessaging ───────────────────────────

export interface PublicKeyBundle {
  userId: string;
  x25519PublicKey: string; // base64
  kyberPublicKey: string;  // base64
  createdAt?: string;
}

export interface IdentityKeys {
  x25519PrivateKey: Uint8Array;
  x25519PublicKey: Uint8Array;
  kyberPrivateKey: Uint8Array;
  kyberPublicKey: Uint8Array;
}

export interface RatchetState {
  rootKey: string;           // base64
  sendingChainKey: string;   // base64
  receivingChainKey: string | null;
  dhSendPub: string;         // base64
  dhSendPriv: string;        // base64
  dhRecvPub: string | null;  // base64
  sendMsgNum: number;
  recvMsgNum: number;
  prevSendChainLen: number;
  epoch: number;
}

export interface SessionState {
  conversationId: string;
  recipientId: string;
  ratchetState: RatchetState;
  established: boolean;
  establishedAt: string;
}

export interface MessageEnvelope {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  ciphertextB64: string;
  dhHeaderB64: string;
  msgNum: number;
  prevChainLen: number;
  timestamp: string;
}

export interface LocalMessage {
  id: string;
  conversationId: string;
  direction: 'outbound' | 'inbound';
  plaintext: string;
  ciphertextPreview: string; // hex preview of first 8 bytes
  timestamp: string;
  epoch: number;
  delivered: boolean;
}

export interface Contact {
  userId: string;
  displayName: string;
  email: string;
  publicKeyBundle?: PublicKeyBundle;
  sessionEstablished: boolean;
  lastMessage?: LocalMessage;
}

export type HandshakeStatus =
  | 'idle'
  | 'fetching_bundle'
  | 'x25519_dh'
  | 'kyber_encapsulate'
  | 'hkdf_derive'
  | 'established'
  | 'error';

export type StreamStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type KeyStatus =
  | 'unknown'
  | 'generating'
  | 'uploading'
  | 'ready'
  | 'error';

// Worker RPC API shape (used by Comlink)
export interface CryptoWorkerAPI {
  generateIdentityKeys(): Promise<{
    x25519PrivKey: string;
    x25519PubKey: string;
    kyberPrivKey: string;
    kyberPubKey: string;
  }>;
  performPQXDH(params: {
    myX25519PrivKey: string;
    theirX25519PubKey: string;
    theirKyberPubKey: string;
  }): Promise<{
    sharedSecret: string;
    kyberCiphertext: string;
    ephemeralX25519PubKey: string;
  }>;
  completeInboundPQXDH(params: {
    myX25519PrivKey: string;
    theirX25519PubKey: string;
    myKyberPrivKey: string;
    kyberCiphertext: string;
  }): Promise<{ sharedSecret: string }>;
  initRatchet(params: {
    sharedSecret: string;
    isInitiator: boolean;
    theirDHPub?: string;
  }): Promise<RatchetState>;
  encryptMessage(params: {
    plaintext: string;
    ratchetState: RatchetState;
  }): Promise<{
    ciphertextB64: string;
    dhHeaderB64: string;
    newRatchetState: RatchetState;
    msgNum: number;
    prevChainLen: number;
  }>;
  decryptMessage(params: {
    ciphertextB64: string;
    dhHeaderB64: string;
    msgNum: number;
    prevChainLen: number;
    ratchetState: RatchetState;
  }): Promise<{ plaintext: string; newRatchetState: RatchetState }>;
}
