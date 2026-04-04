import asyncio
import os
import grpc
from fastapi import FastAPI
from dotenv import load_dotenv
import uvicorn

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), 'core'))

from core.protos import chat_pb2_grpc
from services.chat_service import ChatServiceServicer

load_dotenv()

app = FastAPI(title="SentraMessaging Backend")

async def serve_grpc():
    server = grpc.aio.server()
    chat_pb2_grpc.add_ChatServiceServicer_to_server(ChatServiceServicer(), server)
    
    server.add_insecure_port('[::]:50051')
    await server.start()
    print("gRPC Server started on port 50051")
    await server.wait_for_termination()

@app.on_event("startup")
async def startup_event():
    # Start gRPC server in the background
    asyncio.create_task(serve_grpc())

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
