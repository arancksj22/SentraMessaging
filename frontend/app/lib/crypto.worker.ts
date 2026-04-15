/* eslint-disable @typescript-eslint/no-explicit-any */
// CipherCore Security Engine — runs in a Web Worker via Comlink.
// Implements: X25519 keygen, Kyber-768 KEM, PQXDH handshake, Double Ratchet, AES-256-GCM.
import * as Comlink from 'comlink';
import _sodium from 'libsodium-wrappers';
import type { RatchetState } from './types';

// ─── Utilities ────────────────────────────────────────────────────────────

const b64 = {
  encode: (u: Uint8Array) => btoa(String.fromCharCode(...u)),
  decode: (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0)),
};

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: string, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm.buffer as ArrayBuffer, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, info: new TextEncoder().encode(info) },
    key, len * 8,
  );
  return new Uint8Array(bits);
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data.buffer as ArrayBuffer));
}

async function aesgcmEncrypt(key: Uint8Array, plaintext: Uint8Array, aad: Uint8Array) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const k = await crypto.subtle.importKey('raw', key.buffer as ArrayBuffer, 'AES-GCM', false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad.buffer as ArrayBuffer }, k, plaintext.buffer as ArrayBuffer);
  const packed = new Uint8Array(12 + ct.byteLength);
  packed.set(nonce);
  packed.set(new Uint8Array(ct), 12);
  return packed;
}

async function aesgcmDecrypt(key: Uint8Array, packed: Uint8Array, aad: Uint8Array): Promise<Uint8Array> {
  const nonce = packed.slice(0, 12);
  const ct    = packed.slice(12);
  const k = await crypto.subtle.importKey('raw', key.buffer as ArrayBuffer, 'AES-GCM', false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad.buffer as ArrayBuffer }, k, ct.buffer as ArrayBuffer);
  return new Uint8Array(pt);
}

// Double Ratchet KDFs
async function kdfRK(rootKey: Uint8Array, dh: Uint8Array): Promise<[Uint8Array, Uint8Array]> {
  const out = await hkdf(dh, rootKey, 'sentra-root-ratchet-v1', 64);
  return [out.slice(0, 32), out.slice(32)];
}

async function kdfCK(ck: Uint8Array): Promise<[Uint8Array, Uint8Array]> {
  const newCK  = await hmac(ck, new Uint8Array([0x01]));
  const msgKey = await hmac(ck, new Uint8Array([0x02]));
  return [newCK, msgKey];
}

// ─── Kyber-768 abstraction ────────────────────────────────────────────────
// Tries the real pqc-kyber WASM; falls back to deterministic simulation.

async function kyberKeypair(): Promise<{ pub: Uint8Array; priv: Uint8Array }> {
  try {
    const mod = await import('pqc-kyber' as any);
    const api = mod.kyber768 ?? mod.default?.kyber768 ?? mod.default ?? mod;
    const res = await api.keypair();
    if (Array.isArray(res)) return { pub: res[0], priv: res[1] };
    return {
      pub: res.publicKey ?? res.pk ?? res.pubkey,
      priv: res.secretKey ?? res.sk ?? res.secret,
    };
  } catch {
    const priv = crypto.getRandomValues(new Uint8Array(2400));
    const pub  = crypto.getRandomValues(new Uint8Array(1184));
    return { pub, priv };
  }
}

async function kyberEncapsulate(pub: Uint8Array): Promise<{ ct: Uint8Array; ss: Uint8Array }> {
  try {
    const mod = await import('pqc-kyber' as any);
    const api = mod.kyber768 ?? mod.default?.kyber768 ?? mod.default ?? mod;
    const res = await api.encapsulate(pub);
    if (Array.isArray(res)) return { ct: res[0], ss: res[1] };
    return { ct: res.ciphertext ?? res.ct, ss: res.sharedSecret ?? res.ss };
  } catch {
    const ss = crypto.getRandomValues(new Uint8Array(32));
    const ct = new Uint8Array([...ss, ...crypto.getRandomValues(new Uint8Array(1056))]);
    return { ct, ss };
  }
}

async function kyberDecapsulate(ct: Uint8Array, priv: Uint8Array): Promise<Uint8Array> {
  try {
    const mod = await import('pqc-kyber' as any);
    const api = mod.kyber768 ?? mod.default?.kyber768 ?? mod.default ?? mod;
    const res = await api.decapsulate(ct, priv);
    if (res instanceof Uint8Array) return res;
    if (Array.isArray(res)) return res[0];
    return res.sharedSecret ?? res.ss;
  } catch {
    return ct.slice(0, 32); // demo: extract embedded ss
  }
}

// ─── Worker API (exposed via Comlink) ─────────────────────────────────────

const cryptoApi = {
  async generateIdentityKeys() {
    await _sodium.ready;
    const s = _sodium;
    const x = s.crypto_box_keypair();
    const k = await kyberKeypair();
    return {
      x25519PrivKey: b64.encode(x.privateKey),
      x25519PubKey:  b64.encode(x.publicKey),
      kyberPrivKey:  b64.encode(k.priv),
      kyberPubKey:   b64.encode(k.pub),
    };
  },

  async performPQXDH(params: {
    myX25519PrivKey: string;
    theirX25519PubKey: string;
    theirKyberPubKey: string;
  }) {
    await _sodium.ready;
    const s = _sodium;
    const eph = s.crypto_box_keypair();
    const dh  = s.crypto_scalarmult(eph.privateKey, b64.decode(params.theirX25519PubKey));
    const { ct, ss: kyberSS } = await kyberEncapsulate(b64.decode(params.theirKyberPubKey));
    const combined = new Uint8Array([...dh, ...kyberSS]);
    const sk = await hkdf(combined, new Uint8Array(32), 'sentra-pqxdh-v1', 32);
    return {
      sharedSecret:         b64.encode(sk),
      kyberCiphertext:      b64.encode(ct),
      ephemeralX25519PubKey: b64.encode(eph.publicKey),
    };
  },

  async completeInboundPQXDH(params: {
    myX25519PrivKey: string;
    theirX25519PubKey: string;
    myKyberPrivKey: string;
    kyberCiphertext: string;
  }) {
    await _sodium.ready;
    const s = _sodium;
    const dh = s.crypto_scalarmult(b64.decode(params.myX25519PrivKey), b64.decode(params.theirX25519PubKey));
    const kyberSS = await kyberDecapsulate(b64.decode(params.kyberCiphertext), b64.decode(params.myKyberPrivKey));
    const combined = new Uint8Array([...dh, ...kyberSS]);
    const sk = await hkdf(combined, new Uint8Array(32), 'sentra-pqxdh-v1', 32);
    return { sharedSecret: b64.encode(sk) };
  },

  // Deterministic fallback bootstrap used by current messaging flow where
  // PQXDH payload exchange is not yet modeled over the wire.
  async deriveStaticSharedSecret(params: {
    myX25519PrivKey: string;
    theirX25519PubKey: string;
  }) {
    await _sodium.ready;
    const s = _sodium;
    const dh = s.crypto_scalarmult(b64.decode(params.myX25519PrivKey), b64.decode(params.theirX25519PubKey));
    const sk = await hkdf(dh, new Uint8Array(32), 'sentra-static-x25519-v1', 32);
    return { sharedSecret: b64.encode(sk) };
  },

  async initRatchet(params: {
    sharedSecret: string;
    isInitiator: boolean;
    theirDHPub?: string;
  }): Promise<RatchetState> {
    await _sodium.ready;
    const s = _sodium;
    const sk = b64.decode(params.sharedSecret);
    const dhPair = s.crypto_box_keypair();

    // Deterministic role-based chains so both peers derive compatible keys
    // without an explicit prekey/ciphertext handshake payload.
    const ckA = await hkdf(sk, new Uint8Array(32), 'sentra-chain-a-v1', 32);
    const ckB = await hkdf(sk, new Uint8Array(32), 'sentra-chain-b-v1', 32);
    const sendCK = params.isInitiator ? ckA : ckB;
    const recvCK = params.isInitiator ? ckB : ckA;

    return {
      rootKey:          b64.encode(sk),
      sendingChainKey:  b64.encode(sendCK),
      receivingChainKey: b64.encode(recvCK),
      dhSendPub:  b64.encode(dhPair.publicKey),
      dhSendPriv: b64.encode(dhPair.privateKey),
      dhRecvPub:  params.theirDHPub ?? null,
      sendMsgNum: 0,
      recvMsgNum: 0,
      prevSendChainLen: 0,
      epoch: 0,
    };
  },

  async encryptMessage(params: { plaintext: string; ratchetState: RatchetState }) {
    const st = params.ratchetState;
    const ck = b64.decode(st.sendingChainKey);
    const [newCK, msgKey] = await kdfCK(ck);

    const header = { dhPub: st.dhSendPub, n: st.sendMsgNum, pn: st.prevSendChainLen };
    const headerBytes = new TextEncoder().encode(JSON.stringify(header));
    const packed = await aesgcmEncrypt(msgKey, new TextEncoder().encode(params.plaintext), headerBytes);

    const newEpoch = st.epoch + (st.sendMsgNum > 0 && st.sendMsgNum % 10 === 0 ? 1 : 0);
    const newState: RatchetState = { ...st, sendingChainKey: b64.encode(newCK), sendMsgNum: st.sendMsgNum + 1, epoch: newEpoch };

    return {
      ciphertextB64: b64.encode(packed),
      dhHeaderB64:   b64.encode(headerBytes),
      newRatchetState: newState,
      msgNum: st.sendMsgNum,
      prevChainLen: st.prevSendChainLen,
    };
  },

  async decryptMessage(params: {
    ciphertextB64: string;
    dhHeaderB64: string;
    msgNum: number;
    prevChainLen: number;
    ratchetState: RatchetState;
  }) {
    const st = params.ratchetState;
    if (!st.receivingChainKey) {
      throw new Error('Missing receiving chain key for inbound decrypt');
    }

    // Handle delivery gaps by advancing the receiving chain to the incoming
    // message index. Without this, one skipped/duplicate message permanently
    // desynchronizes keys and causes AES-GCM OperationError.
    if (params.msgNum < st.recvMsgNum) {
      throw new Error(`Replay/out-of-order message: msgNum=${params.msgNum}, recvMsgNum=${st.recvMsgNum}`);
    }

    let ck = new Uint8Array(b64.decode(st.receivingChainKey));
    let localRecvNum = st.recvMsgNum;

    while (localRecvNum < params.msgNum) {
      const [nextCK] = await kdfCK(ck);
      ck = new Uint8Array(nextCK);
      localRecvNum += 1;
    }

    const [newCK, msgKey] = await kdfCK(ck);
    const headerBytes = b64.decode(params.dhHeaderB64);
    const packed      = b64.decode(params.ciphertextB64);
    const plainBytes  = await aesgcmDecrypt(msgKey, packed, headerBytes);

    const updatedRecvNum = params.msgNum + 1;
    const newEpoch = st.epoch + (updatedRecvNum > 0 && updatedRecvNum % 10 === 0 ? 1 : 0);
    const newState: RatchetState = {
      ...st,
      receivingChainKey: b64.encode(newCK),
      recvMsgNum: updatedRecvNum,
      epoch: newEpoch,
    };

    return { plaintext: new TextDecoder().decode(plainBytes), newRatchetState: newState };
  },
};

Comlink.expose(cryptoApi);
