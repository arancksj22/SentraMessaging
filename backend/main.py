import os
import grpc
from fastapi import FastAPI
from fastapi import WebSocket
from fastapi import WebSocketDisconnect
from dotenv import load_dotenv
import uvicorn
from contextlib import asynccontextmanager
import asyncio
import json
import time
import jwt
import redis.asyncio as aioredis
import httpx
from jwt import PyJWKClient
from jwt import InvalidTokenError

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), 'core'))

from core.protos import chat_pb2_grpc
from services.chat_service import ChatServiceServicer

load_dotenv()

async def start_grpc_server() -> grpc.aio.Server:
    server = grpc.aio.server()
    chat_pb2_grpc.add_ChatServiceServicer_to_server(ChatServiceServicer(), server)

    server.add_insecure_port('[::]:50051')
    await server.start()
    print("gRPC Server started on port 50051")
    return server


_jwk_client: PyJWKClient | None = None


async def _verify_supabase_token(token: str) -> str:
    global _jwk_client
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    supabase_key = os.getenv("SUPABASE_KEY", "")

    # Preferred path: ask Supabase Auth API to validate the token.
    if supabase_url and supabase_key:
        user_url = f"{supabase_url}/auth/v1/user"
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {token}",
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(user_url, headers=headers)
            if resp.status_code == 200:
                payload = resp.json()
                user_id = payload.get("id")
                if user_id:
                    return user_id
            elif resp.status_code in (401, 403):
                raise ValueError("Supabase Auth rejected token")
        except Exception:
            # Fall back to local JWT verification if network or endpoint fails.
            pass

    # Prefer Supabase JWKS verification (works with modern ES256/RS256 tokens)
    if supabase_url:
        issuer = f"{supabase_url}/auth/v1"
        jwks_url = f"{issuer}/.well-known/jwks.json"
        if _jwk_client is None:
            _jwk_client = PyJWKClient(jwks_url)
        try:
            signing_key = _jwk_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256"],
                audience="authenticated",
                issuer=issuer,
            )
            user_id = payload.get("sub")
            if not user_id:
                raise ValueError("Invalid token: missing sub claim")
            return user_id
        except InvalidTokenError:
            # Fall through to legacy HS256 verification below.
            pass

    # Fallback for legacy symmetric JWT projects.
    secret = os.getenv("SUPABASE_JWT_SECRET", "")
    if not secret:
        raise ValueError("Token verification failed (JWKS) and SUPABASE_JWT_SECRET is not configured")
    payload = jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Invalid token: missing sub claim")
    return user_id


@asynccontextmanager
async def lifespan(_app: FastAPI):
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    _app.state.redis = aioredis.from_url(redis_url, decode_responses=True)
    grpc_server = await start_grpc_server()
    try:
        yield
    finally:
        await grpc_server.stop(grace=2)
        await _app.state.redis.aclose()


app = FastAPI(title="SentraMessaging Backend", lifespan=lifespan)

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008, reason="Missing token")
        return

    try:
        user_id = await _verify_supabase_token(token)
    except Exception as exc:
        await websocket.close(code=1008, reason=f"Invalid token: {exc}")
        return

    await websocket.accept()

    channel = f"user:{user_id}"
    redis_client = app.state.redis
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(channel)

    async def _forward_redis_messages():
        async for event in pubsub.listen():
            if event.get("type") != "message":
                continue
            data = event.get("data")
            if data is None:
                continue
            # Payload is already JSON text; forward to browser as-is.
            await websocket.send_text(str(data))

    redis_task = asyncio.create_task(_forward_redis_messages())

    try:
        while True:
            raw = await websocket.receive_text()

            if raw == "ping":
                await websocket.send_text("pong")
                continue

            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue

            receiver_id = payload.get("recipientId")
            if not receiver_id:
                continue

            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            envelope = {
                "id": payload.get("id") or f"{user_id}-{int(time.time() * 1000)}",
                "conversationId": payload.get("conversationId") or ":".join(sorted([user_id, receiver_id])),
                "senderId": user_id,
                "recipientId": receiver_id,
                "ciphertextB64": payload.get("ciphertextB64", ""),
                "dhHeaderB64": payload.get("dhHeaderB64", ""),
                "msgNum": int(payload.get("msgNum", 0) or 0),
                "prevChainLen": int(payload.get("prevChainLen", 0) or 0),
                "timestamp": payload.get("timestamp") or now_iso,
            }
            handshake = payload.get("handshake")
            if isinstance(handshake, dict):
                envelope["handshake"] = handshake
            control = payload.get("control")
            if isinstance(control, dict):
                envelope["control"] = control
            await redis_client.publish(f"user:{receiver_id}", json.dumps(envelope))
    except WebSocketDisconnect:
        pass
    finally:
        redis_task.cancel()
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
