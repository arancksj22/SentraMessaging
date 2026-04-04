import asyncio
import httpx
import grpc
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), 'core'))
from core.protos import chat_pb2, chat_pb2_grpc

async def run_chat_client(user_id, receiver_id, message_text):
    print(f"[{user_id}] Connecting to gRPC server at 127.0.0.1:50051...")
    
    # We use an asyncio Queue to send messages to the server
    send_queue = asyncio.Queue()
    
    # Initial message to set up our identity and send a message
    initial_message = chat_pb2.ClientMessage(
        token=user_id,  # Using token as our user_id for this test
        receiver_id=receiver_id,
        encrypted_payload=message_text.encode('utf-8'),
        message_type="text",
        ratchet_key="dummy_key"
    )
    await send_queue.put(initial_message)

    async def request_generator():
        while True:
            msg = await send_queue.get()
            if msg is None:
                break
            yield msg

    async with grpc.aio.insecure_channel('127.0.0.1:50051') as channel:
        stub = chat_pb2_grpc.ChatServiceStub(channel)
        
        # Call the bidirectional stream
        call = stub.StreamMessages(request_generator())
        
        print(f"[{user_id}] Connected and sending message: '{message_text}' to {receiver_id}")
        
        # Read exactly one message from the server (which should be the reply)
        try:
            response = await call.read()
            if response:
                print(f"[{user_id}] Received message from {response.sender_id}: {response.encrypted_payload.decode('utf-8')}")
        except Exception as e:
            print(f"[{user_id}] Error receiving: {e}")
            
        # Signal the generator to stop
        await send_queue.put(None)

async def test_health():
    print("[Test] Checking FastAPI HTTP /health endpoint...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get("http://127.0.0.1:8000/health")
            print(f"[Test] Health response: {response.status_code} - {response.json()}")
        except Exception as e:
            print(f"[Test] Health check failed: {e}")

async def main():
    print("=== Starting Backend Automated Tests ===")
    
    # Wait for services to be ready
    await asyncio.sleep(2)
    
    # 1. Test HTTP REST endpoint
    await test_health()
    print("-" * 40)
    
    # 2. Test gRPC Bidirectional Streaming & Redis Pub/Sub Routing
    # We will run two clients concurrently.
    # Alice will send a message to Bob, and Bob will send a message to Alice.
    print("[Test] Starting gRPC bi-directional Pub/Sub test...")
    
    task_alice = asyncio.create_task(run_chat_client("Alice", "Bob", "Hello Bob! This is Alice."))
    task_bob = asyncio.create_task(run_chat_client("Bob", "Alice", "Hi Alice! I am Bob."))
    
    await asyncio.gather(task_alice, task_bob)
    
    print("=== All Tests Completed ===")

if __name__ == "__main__":
    asyncio.run(main())
