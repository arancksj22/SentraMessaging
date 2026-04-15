import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SessionState, LocalMessage } from './types';

interface SentraDB extends DBSchema {
  identity_keys: {
    key: string;
    value: {
      userId: string;
      x25519PrivKey: ArrayBuffer;
      x25519PubKey: ArrayBuffer;
      kyberPrivKey: ArrayBuffer;
      kyberPubKey: ArrayBuffer;
      createdAt: string;
    };
  };
  sessions: {
    key: string; // conversationId
    value: SessionState;
    indexes: { 'by-recipient': string };
  };
  messages: {
    key: string; // message id
    value: LocalMessage;
    indexes: { 'by-conversation': string };
  };
}

let _db: IDBPDatabase<SentraDB> | null = null;

async function getDB(): Promise<IDBPDatabase<SentraDB>> {
  if (_db) return _db;
  _db = await openDB<SentraDB>('sentra-db', 1, {
    upgrade(db) {
      db.createObjectStore('identity_keys', { keyPath: 'userId' });
      const sessions = db.createObjectStore('sessions', { keyPath: 'conversationId' });
      sessions.createIndex('by-recipient', 'recipientId');
      const messages = db.createObjectStore('messages', { keyPath: 'id' });
      messages.createIndex('by-conversation', 'conversationId');
    },
  });
  return _db;
}

// ─── Identity Keys ─────────────────────────────────────────────────────────

export async function saveIdentityKeys(userId: string, keys: {
  x25519PrivKey: Uint8Array;
  x25519PubKey: Uint8Array;
  kyberPrivKey: Uint8Array;
  kyberPubKey: Uint8Array;
}) {
  const db = await getDB();
  await db.put('identity_keys', {
    userId,
    x25519PrivKey: keys.x25519PrivKey.buffer.slice(keys.x25519PrivKey.byteOffset, keys.x25519PrivKey.byteOffset + keys.x25519PrivKey.byteLength),
    x25519PubKey: keys.x25519PubKey.buffer.slice(keys.x25519PubKey.byteOffset, keys.x25519PubKey.byteOffset + keys.x25519PubKey.byteLength),
    kyberPrivKey: keys.kyberPrivKey.buffer.slice(keys.kyberPrivKey.byteOffset, keys.kyberPrivKey.byteOffset + keys.kyberPrivKey.byteLength),
    kyberPubKey: keys.kyberPubKey.buffer.slice(keys.kyberPubKey.byteOffset, keys.kyberPubKey.byteOffset + keys.kyberPubKey.byteLength),
    createdAt: new Date().toISOString(),
  });
}

export async function getIdentityKeys(userId: string) {
  const db = await getDB();
  const rec = await db.get('identity_keys', userId);
  if (!rec) return null;
  return {
    x25519PrivKey: new Uint8Array(rec.x25519PrivKey),
    x25519PubKey:  new Uint8Array(rec.x25519PubKey),
    kyberPrivKey:  new Uint8Array(rec.kyberPrivKey),
    kyberPubKey:   new Uint8Array(rec.kyberPubKey),
  };
}

// ─── Sessions ──────────────────────────────────────────────────────────────

export async function saveSession(session: SessionState) {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function getSession(conversationId: string) {
  const db = await getDB();
  return db.get('sessions', conversationId);
}

export async function getSessionByRecipient(recipientId: string) {
  const db = await getDB();
  return db.getFromIndex('sessions', 'by-recipient', recipientId);
}

export async function deleteSession(conversationId: string) {
  const db = await getDB();
  await db.delete('sessions', conversationId);
}

// ─── Messages ──────────────────────────────────────────────────────────────

export async function saveMessage(message: LocalMessage) {
  const db = await getDB();
  await db.put('messages', message);
}

export async function getConversationMessages(conversationId: string): Promise<LocalMessage[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('messages', 'by-conversation', conversationId);
  return all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function clearConversationMessages(conversationId: string) {
  const db = await getDB();
  const tx = db.transaction('messages', 'readwrite');
  const idx = tx.store.index('by-conversation');
  let cursor = await idx.openCursor(IDBKeyRange.only(conversationId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}
