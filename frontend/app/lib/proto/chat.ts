// chat.ts — TypeScript types hand-typed from chat.proto
// Package: chat | Service: ChatService.StreamMessages
//
// For production codegen run:
//   npx buf generate
// (requires buf.gen.yaml — see project root)

/** ClientMessage: client → server over the bidirectional stream */
export interface ClientMessage {
  token:             string;     // Supabase JWT auth token
  receiver_id:       string;     // destination user ID
  encrypted_payload: string;     // base64-encoded AES-256-GCM ciphertext
  message_type:      string;     // "text" | "media"
  ratchet_key:       string;     // Double Ratchet DH header — JSON: { dhPub, n, pn }
}

/** ServerMessage: server → client over the bidirectional stream */
export interface ServerMessage {
  sender_id:         string;
  encrypted_payload: string;     // base64-encoded ciphertext
  message_type:      string;
  ratchet_key:       string;     // Double Ratchet DH header from sender
  timestamp:         string;     // int64 unix ms — comes as string in JSON transcoding
}
