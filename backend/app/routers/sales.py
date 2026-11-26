from datetime import date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status, Depends
from app.database import get_supabase
from app.security import get_current_user

router = APIRouter()

today_str = date.today().isoformat()

# In-memory store fallback if Supabase is offline/using dummy credentials
_FALLBACK_SALES = [
    {
        "id": "c0000000-0000-0000-0000-000000000001",
        "salon_id": "SAL-004",
        "salon_name": "Aura Wellness & Hair Bar",
        "executive_id": "a0000000-0000-0000-0000-000000000002",
        "product_package": "Enterprise Package",
        "num_branches": 3,
        "monthly_subscription": 8999.00,
        "implementation_charges": 15000.00,
        "discount": 2000.00,
        "gst": 7199.46,
        "total_amount": 47196.46,
        "sales_date": today_str
    }
]

class CreateSaleRequest(BaseModel):
    salon_id: str
    salon_name: Optional[str] = None
    product_package: str
    num_branches: Optional[int] = 1
    monthly_subscription: Optional[float] = 0.0
    implementation_charges: Optional[float] = 0.0
    discount: Optional[float] = 0.0
    gst: Optional[float] = 0.0
    total_amount: float
    sales_date: Optional[str] = None

@router.get("", response_model=List[Dict[str, Any]])
async def get_sales(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Fetch all recorded sales opportunities."""
    try:
        db = get_supabase()
        res = db.table("sales_opportunities").select("*, salons(salon_name)").order("sales_date", desc=True).execute()
        if res.data:
            formatted = []
            for s in res.data:
                s_copy = {**s}
                if isinstance(s.get("salons"), dict):
                    s_copy["salon_name"] = s["salons"].get("salon_name", "Salon Outlet")
                formatted.append(s_copy)
            return formatted
    except Exception:
        pass

    return _FALLBACK_SALES

@router.post("", response_model=Dict[str, Any])
async def record_sale(
    request: CreateSaleRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Records a sales opportunity and updates target salon lead_status to 'Converted'.
    """
    exec_id = current_user.get("id") or "a0000000-0000-0000-0000-000000000002"
    sales_date = request.sales_date or today_str

    data = {
        "salon_id": request.salon_id,
        "executive_id": exec_id,
        "product_package": request.product_package,
        "num_branches": request.num_branches or 1,
        "monthly_subscription": request.monthly_subscription or 0.0,
        "implementation_charges": request.implementation_charges or 0.0,
        "discount": request.discount or 0.0,
        "gst": request.gst or 0.0,
        "total_amount": request.total_amount,
        "sales_date": sales_date
    }

    try:
        db = get_supabase()
        res = db.table("sales_opportunities").insert(data).execute()
        # Mark salon as Converted
        db.table("salons").update({"lead_status": "Converted"}).eq("salon_id", request.salon_id).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception:
        pass

    # Fallback in-memory
    new_id = f"c0000000-0000-0000-0000-{len(_FALLBACK_SALES)+1:012d}"
    data["id"] = new_id
    data["salon_name"] = request.salon_name or "Salon Outlet"
    _FALLBACK_SALES.insert(0, data)
    return data
