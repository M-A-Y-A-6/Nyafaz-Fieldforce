from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, users, salons, visits, sales, dashboard

app = FastAPI(
    title="Nyafaz FieldForce API",
    description="FastAPI Backend for Nyafaz FieldForce with Supabase & JWT Authentication",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wire Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users & Performance"])
app.include_router(salons.router, prefix="/api/salons", tags=["Salons"])
app.include_router(visits.router, prefix="/api/visits", tags=["Visits"])
app.include_router(sales.router, prefix="/api/sales", tags=["Sales"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])

@app.get("/api/health", tags=["Health"])
async def health_check():
    """Service health and diagnostic check."""
    return {
        "status": "healthy",
        "service": "Nyafaz FieldForce API",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
