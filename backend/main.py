import os
import grpc
from fastapi import FastAPI
from dotenv import load_dotenv
import uvicorn
from contextlib import asynccontextmanager

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


@asynccontextmanager
async def lifespan(_app: FastAPI):
    grpc_server = await start_grpc_server()
    try:
        yield
    finally:
        await grpc_server.stop(grace=2)


app = FastAPI(title="SentraMessaging Backend", lifespan=lifespan)

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
