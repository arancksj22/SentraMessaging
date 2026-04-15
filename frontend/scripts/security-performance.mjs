import { performance } from 'node:perf_hooks';
import sodium from 'libsodium-wrappers';

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

async function hkdf(ikm, salt, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm.buffer, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt.buffer,
      info: new TextEncoder().encode(info),
    },
    key,
    len * 8,
  );
  return new Uint8Array(bits);
}

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key.buffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data.buffer));
}

async function kdfCK(ck) {
  const newCK = await hmac(ck, new Uint8Array([0x01]));
  const msgKey = await hmac(ck, new Uint8Array([0x02]));
  return [newCK, msgKey];
}

async function aesgcmEncrypt(key, plaintext, aad) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const k = await crypto.subtle.importKey('raw', key.buffer, 'AES-GCM', false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad.buffer }, k, plaintext.buffer);
  const packed = new Uint8Array(12 + ct.byteLength);
  packed.set(nonce);
  packed.set(new Uint8Array(ct), 12);
  return packed;
}

async function aesgcmDecrypt(key, packed, aad) {
  const nonce = packed.slice(0, 12);
  const ct = packed.slice(12);
  const k = await crypto.subtle.importKey('raw', key.buffer, 'AES-GCM', false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad.buffer }, k, ct.buffer);
  return new Uint8Array(pt);
}

async function benchmark(name, iterations, fn) {
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const t0 = performance.now();
    await fn();
    const t1 = performance.now();
    samples.push(t1 - t0);
  }
  return {
    name,
    iterations,
    meanMs: mean(samples),
    p50Ms: percentile(samples, 50),
    p95Ms: percentile(samples, 95),
  };
}

async function loadKyberApi() {
  try {
    const mod = await import('pqc-kyber/pqc_kyber.js');
    return mod.kyber768 ?? mod.default?.kyber768 ?? mod.default ?? mod;
  } catch {
    try {
      const mod = await import('pqc-kyber');
      return mod.kyber768 ?? mod.default?.kyber768 ?? mod.default ?? mod;
    } catch {
      return null;
    }
  }
}

function normalizeKeypair(kp) {
  if (Array.isArray(kp)) return { pub: kp[0], priv: kp[1] };
  return {
    pub: kp.publicKey ?? kp.pk ?? kp.pubkey,
    priv: kp.secretKey ?? kp.sk ?? kp.secret,
  };
}

async function run() {
  await sodium.ready;

  const results = [];

  const alice = sodium.crypto_box_keypair();
  const bob = sodium.crypto_box_keypair();
  results.push(await benchmark('X25519 DH', 200, async () => {
    sodium.crypto_scalarmult(alice.privateKey, bob.publicKey);
  }));

  const ikm = sodium.crypto_scalarmult(alice.privateKey, bob.publicKey);
  results.push(await benchmark('HKDF-SHA256 (32 bytes)', 200, async () => {
    await hkdf(ikm, new Uint8Array(32), 'sentra-bench', 32);
  }));

  const base = crypto.getRandomValues(new Uint8Array(32));
  results.push(await benchmark('Double Ratchet CK step (HMACx2)', 200, async () => {
    await kdfCK(base);
  }));

  const key = crypto.getRandomValues(new Uint8Array(32));
  const aad = new TextEncoder().encode('{"dhPub":"bench","n":0,"pn":0}');
  const payload = crypto.getRandomValues(new Uint8Array(1024));
  results.push(await benchmark('AES-256-GCM encrypt 1KB', 200, async () => {
    await aesgcmEncrypt(key, payload, aad);
  }));

  const encrypted = await aesgcmEncrypt(key, payload, aad);
  results.push(await benchmark('AES-256-GCM decrypt 1KB', 200, async () => {
    await aesgcmDecrypt(key, encrypted, aad);
  }));

  const kyberApi = await loadKyberApi();
  if (kyberApi) {
    const kp = normalizeKeypair(await kyberApi.keypair());
    results.push(await benchmark('Kyber keypair', 50, async () => {
      await kyberApi.keypair();
    }));

    let sampleCt;
    let sampleSs;
    results.push(await benchmark('Kyber encapsulate', 50, async () => {
      const enc = await kyberApi.encapsulate(kp.pub);
      sampleCt = Array.isArray(enc) ? enc[0] : (enc.ciphertext ?? enc.ct);
      sampleSs = Array.isArray(enc) ? enc[1] : (enc.sharedSecret ?? enc.ss);
    }));

    results.push(await benchmark('Kyber decapsulate', 50, async () => {
      await kyberApi.decapsulate(sampleCt, kp.priv);
    }));

    if (!sampleCt || !sampleSs) {
      throw new Error('Kyber benchmark failed to produce sample ciphertext/shared secret');
    }
  }

  console.log('Security Performance Benchmark');
  console.log('==============================');
  for (const r of results) {
    console.log(`${r.name}: mean=${r.meanMs.toFixed(3)}ms p50=${r.p50Ms.toFixed(3)}ms p95=${r.p95Ms.toFixed(3)}ms (n=${r.iterations})`);
  }

  console.log('\nJSON');
  console.log(JSON.stringify(results, null, 2));
}

await run();
