# Project Brief: Post-Quantum Secured Messaging Framework

## Executive Summary
This project is a high-performance, real-time messaging framework designed with a **Zero-Knowledge Architecture**. It prioritizes future-proof security by combining classical elliptic curve cryptography with post-quantum algorithms, ensuring that message data remains encrypted even against future quantum computing threats.

---

## 🏗 System Architecture
The system utilizes a modern, asynchronous stack to handle high-concurrency bi-directional streaming.

### Core Component Stack
| Component | Purpose | Tech Stack |
| :--- | :--- | :--- |
| **Frontend UI** | Client-side interface & local encryption/decryption. | React (Vite) + gRPC-Web |
| **Identity/Auth** | User management & Public Key Bundle storage. | Supabase (PostgreSQL) |
| **The Bridge** | Translates Browser gRPC-Web to Native gRPC. | Envoy Proxy |
| **The Core API** | Orchestrates message routing & stream management. | FastAPI (Python) |
| **Message Broker** | Real-time Pub/Sub for cross-instance messaging. | Redis |
| **Orchestrator** | Unified demo environment & network bridging. | Docker Compose |

---

## 🛡 Security Infrastructure
The framework implements a multi-layered security protocol to ensure message integrity, confidentiality, and forward secrecy.

### Cryptographic Implementation
* **Identity Handshake (PQXDH):** Combines **X25519** (Classical ECC) with **Kyber-768** (Post-Quantum) to resist harvest-now-decrypt-later attacks.
* **Session Ratchet:** Uses the **Double Ratchet Algorithm** (Signal Protocol) to provide Perfect Forward Secrecy (PFS).
* **Data Encryption:** All payloads are encrypted using **AES-256-GCM**, providing authenticated encryption to detect tampering.

### Security Summary Table
| Feature | Security Algorithm | Purpose |
| :--- | :--- | :--- |
| **Post-Quantum Resilience** | PQXDH (X25519 + Kyber-768) | Protection against quantum computer-assisted decryption. |
| **Forward Secrecy** | Double Ratchet Algorithm | Ensuring compromised keys cannot decrypt past messages. |
| **Message Integrity** | AES-256-GCM | Authenticated encryption to ensure no bits were flipped in transit. |
| **Zero-Knowledge** | Client-side Encryption | The server acts as a directory; it never sees or stores private keys. |
| **Transport Security** | gRPC Bi-directional Streams | Binary protocol for high performance and reduced interception risk. |

---

## 🔄 Technical Workflow
1.  **Handshake:** Clients fetch Public Key Bundles from Supabase and perform a **PQXDH** exchange to establish a shared secret.
2.  **Connection:** The React frontend initiates a gRPC-Web stream, which **Envoy Proxy** translates into native gRPC for the **FastAPI** backend.
3.  **Messaging:** Messages are encrypted locally via **AES-256-GCM** and sent through the bi-directional stream.
4.  **Routing:** FastAPI utilizes **Redis Pub/Sub** to route messages to the correct user instance in a distributed environment.
5.  **Ratchet:** With every message sent/received, the **Double Ratchet** updates the encryption keys, ensuring that even if a session key is compromised, the rest of the conversation remains secure.