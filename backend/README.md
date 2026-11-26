# Nyafaz FieldForce - FastAPI Backend

FastAPI backend application for **Nyafaz FieldForce** integrating with Supabase (PostgreSQL), JWT Bearer authentication, and role-based access control.

---

## Architecture & Directory Structure

```
backend/
├── .env.example              # Environment variables template
├── .env                      # Local environment configuration
├── requirements.txt          # Python dependencies
├── .venv/                    # Python virtual environment (Python 3.12)
├── database/
│   ├── README.md             # Supabase schema & migration guide
│   ├── schema.sql            # DDL for users, salons, visits, sales_opportunities
│   └── seed.sql              # Idempotent seed data (demo credentials)
├── app/
│   ├── __init__.py
│   ├── config.py             # Pydantic Settings & environment loader
│   ├── database.py           # Supabase client singleton
│   ├── main.py               # FastAPI application with CORS & health check
│   ├── security.py           # Bcrypt hashing, JWT generation, get_current_user & require_manager
│   └── routers/
│       ├── __init__.py
│       ├── auth.py           # POST /api/auth/login, GET /api/auth/me
│       └── users.py          # GET /api/users, POST /api/users/executives
└── tests/
    └── test_backend.py       # Validation suite for security & routing
```

---

## Setup & Running the Server

### 1. Activate the Virtual Environment
- **Windows (PowerShell)**:
  ```powershell
  backend\.venv\Scripts\Activate.ps1
  ```
- **Windows (CMD)**:
  ```cmd
  backend\.venv\Scripts\activate.bat
  ```

### 2. Configure `.env`
Ensure `backend/.env` is populated with your Supabase credentials:
```env
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
JWT_SECRET=<your-secure-jwt-secret>
JWT_ALGORITHM=HS256
DAILY_ASSIGNMENT_LIMIT=3
FRONTEND_URL=http://localhost:5173
```

### 3. Start the Development Server
```bash
uvicorn app.main:app --app-dir backend --reload --port 8000
```
or run with the virtualenv Python directly:
```powershell
& "backend/.venv/Scripts/python.exe" -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

- **Interactive API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative API Documentation (ReDoc)**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## API Endpoints Implemented

### Authentication (`/api/auth`)
- **`POST /api/auth/login`**: Authenticate using `email` and `password`. Returns JWT `access_token` and user profile.
- **`GET /api/auth/me`**: Returns the profile of the currently authenticated user (Bearer token required).

### User Management (`/api/users`)
- **`GET /api/users`**: List sales executives with aggregated performance metrics (`assigned_visits`, `completed_visits`, `conversions`). Requires `manager` role.
- **`POST /api/users/executives`**: Onboard a new executive with bcrypt hashed password. Requires `manager` role.
