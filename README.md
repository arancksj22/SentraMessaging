# SentraMessaging

Local-first setup for the SentraMessaging frontend and backend.

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- Python `venv` + `pip`

## Repository Structure

- `frontend/` Next.js app (UI + client-side crypto)
- `backend/` FastAPI + gRPC + Redis routing service
- `protos/` shared protobuf contracts
- `docs/` project documentation

## Backend: Local Setup

From repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create and fill `backend/.env`:

- `REDIS_URL` pointing to Redis Cloud
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_JWT_SECRET`

If you do not already have Redis running locally, start one in Docker:

```powershell
docker run --name sentra-redis -p 6379:6379 redis:7-alpine
```

Run backend locally:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python main.py
```

Backend endpoints:

- FastAPI health: `http://127.0.0.1:8000/health`
- Native gRPC: `127.0.0.1:50051`
- Browser WebSocket messaging: `ws://127.0.0.1:8000/ws/chat`

Optional backend smoke test (with backend running):

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python test_client.py
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

### Security Feature Test

From `frontend/`, run:

```powershell
npm run test:security
```

Detailed explanation is in `docs/Security-Feature-Testing.md`.

### Frontend Environment

Create `frontend/.env.local` if you want real Supabase auth:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_BACKEND_WS_URL=ws://127.0.0.1:8000/ws/chat
```

If these values are missing, the app runs in demo mode automatically.

## Running Both Services

Use two terminals:

Terminal 1:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python main.py
```

Terminal 2:

```powershell
cd frontend
npm run dev
```