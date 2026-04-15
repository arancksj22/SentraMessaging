# SentraMessaging

Local-first setup for the SentraMessaging frontend and backend.

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- `uv` for Python environment and package management

## Repository Structure

- `frontend/` Next.js app (UI + client-side crypto)
- `backend/` FastAPI + gRPC + Redis routing service
- `protos/` shared protobuf contracts
- `docs/` project documentation

## Backend: Local Setup

From repository root:

```powershell
cd backend
uv venv
uv pip install -r requirements.txt
uv run python -m grpc_tools.protoc -I.. --python_out=core --grpc_python_out=core ..\protos\chat.proto
```

Create and fill `backend/.env`:

- `REDIS_URL` pointing to Redis Cloud
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_JWT_SECRET`

Run backend locally:

```powershell
cd backend
uv run python main.py
```

Backend endpoints:

- FastAPI health: `http://127.0.0.1:8000/health`
- Native gRPC: `127.0.0.1:50051`

Optional backend smoke test (with backend running):

```powershell
cd backend
uv run python test_client.py
```

## Frontend: Local Setup

From repository root:

```powershell
cd frontend
npm install
npm run dev
```

Frontend default URL:

- `http://localhost:3000`

### Frontend Environment

Create `frontend/.env.local` if you want real Supabase auth:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

If these values are missing, the app runs in demo mode automatically.

## Running Both Services

Use two terminals:

Terminal 1:

```powershell
cd backend
uv run python main.py
```

Terminal 2:

```powershell
cd frontend
npm run dev
```