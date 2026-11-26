from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, HTTPException, status, Depends
from app.database import get_supabase
from app.security import verify_password, create_access_token, get_current_user

router = APIRouter()

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserProfileResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    created_at: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Validates email and password credentials against Supabase users table.
    Returns a signed JWT access token and user profile.
    """
    email = request.email.lower().strip()
    db = get_supabase()
    
    try:
        response = db.table("users").select(
            "id, full_name, email, password_hash, role, created_at"
        ).eq("email", email).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query error: {str(e)}"
        )

    users = response.data or []
    if not users:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = users[0]
    if not verify_password(request.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(user_id=user["id"], role=user["role"])

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserProfileResponse(
            id=str(user["id"]),
            full_name=user["full_name"],
            email=user["email"],
            role=user["role"],
            created_at=str(user.get("created_at") or "")
        )
    )

@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns the authenticated user's profile.
    """
    return UserProfileResponse(
        id=str(current_user["id"]),
        full_name=current_user["full_name"],
        email=current_user["email"],
        role=current_user["role"],
        created_at=str(current_user.get("created_at") or "")
    )
