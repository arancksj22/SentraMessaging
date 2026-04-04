import asyncio
import os
import redis.asyncio as aioredis
import sys
import json

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'core'))
from core.protos import chat_pb2, chat_pb2_grpc

class ChatServiceServicer(chat_pb2_grpc.ChatServiceServicer):
    def __init__(self):
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis = aioredis.from_url(redis_url, decode_responses=False)
        self.pubsub_channels = {}

    async def StreamMessages(self, request_iterator, context):
        queue = asyncio.Queue()
        user_id = None
        redis_task = None
        
        async def _read_from_redis(user):
            pubsub = self.redis.pubsub()
            await pubsub.subscribe(f"user:{user}")
            try:
                async for message in pubsub.listen():
                    if message['type'] == 'message':
                        try:
                            # Parse Redis message and push to gRPC response queue
                            data = message['data']
                            payload_dict = json.loads(data)
                            server_msg = chat_pb2.ServerMessage(
                                sender_id=payload_dict.get('sender_id', ''),
                                encrypted_payload=bytes.fromhex(payload_dict.get('encrypted_payload', '')),
                                message_type=payload_dict.get('message_type', ''),
                                ratchet_key=payload_dict.get('ratchet_key', ''),
                                timestamp=payload_dict.get('timestamp', 0)
                            )
                            await queue.put(server_msg)
                        except Exception as e:
                            print(f"Error parsing redis message: {e}")
            finally:
                await pubsub.unsubscribe(f"user:{user}")

        async def _read_from_client():
            nonlocal user_id, redis_task
            try:
                async for client_message in request_iterator:
                    if user_id is None:
                        # Auth: Normally extract user_id from token via Supabase JWT verification
                        user_id = getattr(client_message, 'token', 'default_user') or 'default_user'
                        # Start listening to redis for targeted messages
                        redis_task = asyncio.create_task(_read_from_redis(user_id))
                    
                    # Prepare to publish to the receiver's Redis channel
                    import time
                    receiver_channel = f"user:{client_message.receiver_id}"
                    payload = json.dumps({
                        "sender_id": user_id,
                        "encrypted_payload": client_message.encrypted_payload.hex(),
                        "message_type": client_message.message_type,
                        "ratchet_key": client_message.ratchet_key,
                        "timestamp": int(time.time() * 1000)
                    })
                    await self.redis.publish(receiver_channel, payload)
            except asyncio.CancelledError:
                pass
            finally: # Client disconnected
                await queue.put(None) # Signal termination

        client_task = asyncio.create_task(_read_from_client())
        
        try:
            while True:
                msg = await queue.get()
                if msg is None:
                    break # Client closed
                yield msg
        finally:
            client_task.cancel()
            if redis_task:
                redis_task.cancel()
