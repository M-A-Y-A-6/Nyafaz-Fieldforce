from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from fastapi import APIRouter, HTTPException, status, Depends
from app.database import get_supabase
from app.security import get_current_user, require_manager, get_password_hash
from app.config import settings

router = APIRouter()

class CreateExecutiveRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str

class ExecutiveCreatedResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    created_at: Optional[str] = None

class ExecutivePerformanceResponse(BaseModel):
    id: str
    full_name: str
    name: Optional[str] = None  # Frontend convenience alias
    email: str
    role: str
    created_at: Optional[str] = None
    assigned_visits: int = 0
    pending_visits: int = 0
    completed_visits: int = 0
    conversions: int = 0
    daily_task_counts: Dict[str, int] = Field(default_factory=dict)
    blocked_dates: List[str] = Field(default_factory=list)

@router.get("", response_model=List[ExecutivePerformanceResponse])
@router.get("/executives", response_model=List[ExecutivePerformanceResponse])
async def list_executives(
    current_user: Dict[str, Any] = Depends(require_manager)
):
    """
    List sales executives ordered by full_name with computed performance metrics:
    - assigned_visits (total visits scheduled for this executive)
    - pending_visits (visits with status 'Pending' or 'In Progress')
    - completed_visits (visits with status 'Completed')
    - conversions (sales opportunities / salons converted by this executive)
    Protected by manager role.
    """
    db = get_supabase()
    try:
        # Fetch all executive users ordered by full_name
        users_res = db.table("users").select(
            "id, full_name, email, role, created_at"
        ).eq("role", "executive").order("full_name").execute()
        executives = users_res.data or []

        if not executives:
            return []

        # Fetch visits to compute assignment and status counts
        visits_res = db.table("visits").select("id, executive_id, status, scheduled_date").execute()
        visits = visits_res.data or []

        # Fetch sales_opportunities to compute sales conversions
        sales_res = db.table("sales_opportunities").select("id, executive_id, salon_id").execute()
        sales = sales_res.data or []

        # Fetch salons to compute salon conversions
        salons_res = db.table("salons").select("salon_id, assigned_executive_id, lead_status").execute()
        salons = salons_res.data or []

        result = []
        for exec_user in executives:
            exec_id = str(exec_user["id"])
            exec_visits = [v for v in visits if str(v.get("executive_id")) == exec_id]
            assigned_count = len(exec_visits)
            pending_count = len([v for v in exec_visits if v.get("status") in ["Pending", "In Progress"]])
            completed_count = len([v for v in exec_visits if v.get("status") == "Completed"])

            # Compute daily task counts and blocked dates
            daily_task_counts: Dict[str, int] = {}
            for v in exec_visits:
                sched_d = str(v.get("scheduled_date") or "").strip()
                if sched_d:
                    daily_task_counts[sched_d] = daily_task_counts.get(sched_d, 0) + 1

            blocked_dates = sorted([
                d for d, count in daily_task_counts.items()
                if count >= settings.DAILY_ASSIGNMENT_LIMIT
            ])
            
            # Count conversions from sales_opportunities and/or salons with lead_status 'Converted'
            sales_conversions = len([s for s in sales if str(s.get("executive_id")) == exec_id])
            salon_conversions = len([
                s for s in salons
                if str(s.get("assigned_executive_id")) == exec_id and s.get("lead_status") == "Converted"
            ])
            conversions_count = max(sales_conversions, salon_conversions)

            result.append(
                ExecutivePerformanceResponse(
                    id=exec_id,
                    full_name=exec_user["full_name"],
                    name=exec_user["full_name"],
                    email=exec_user["email"],
                    role=exec_user["role"],
                    created_at=str(exec_user.get("created_at") or ""),
                    assigned_visits=assigned_count,
                    pending_visits=pending_count,
                    completed_visits=completed_count,
                    conversions=conversions_count,
                    daily_task_counts=daily_task_counts,
                    blocked_dates=blocked_dates
                )
            )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch executives: {str(e)}"
        )

@router.post(
    "/executives",
    response_model=ExecutiveCreatedResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_executive(
    request: CreateExecutiveRequest,
    current_user: Dict[str, Any] = Depends(require_manager)
):
    """
    Creates a new Sales Executive user with a hashed password and role='executive'.
    - Validates email is unique (returns 400 with 'An account with this email already exists.')
    - Hashes password using bcrypt
    - Inserts record into users table
    - Returns HTTP 201 with { id, full_name, email, role, created_at }
    Protected by manager role.
    """
    clean_name = request.full_name.strip()
    clean_email = request.email.lower().strip()

    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name cannot be empty."
        )
    if not request.password or len(request.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    db = get_supabase()
    try:
        # Check if email is already registered in users table
        existing_res = db.table("users").select("id").eq("email", clean_email).execute()
        if existing_res.data and len(existing_res.data) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists."
            )

        hashed_password = get_password_hash(request.password)
        new_user_data = {
            "full_name": clean_name,
            "email": clean_email,
            "password_hash": hashed_password,
            "role": "executive"
        }

        insert_res = db.table("users").insert(new_user_data).execute()
        if not insert_res.data or len(insert_res.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to insert user record into database."
            )

        created = insert_res.data[0]
        return ExecutiveCreatedResponse(
            id=str(created["id"]),
            full_name=created["full_name"],
            email=created["email"],
            role=created["role"],
            created_at=str(created.get("created_at") or "")
        )
    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e).lower()
        if "duplicate" in err_msg or "unique" in err_msg or "23505" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating executive: {str(e)}"
        )
