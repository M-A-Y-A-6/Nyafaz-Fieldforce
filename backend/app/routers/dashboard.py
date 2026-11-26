from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_supabase
from app.security import get_current_user

router = APIRouter()

@router.get("/summary", response_model=Dict[str, Any])
async def get_dashboard_summary(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Computes high-level operational metrics directly from live Supabase tables:
    - total_salons: count of rows in salons table
    - total_executives: count of users where role == 'executive'
    - completed_visits: count of visits where status == 'Completed'
    - pending_visits: count of visits where status is 'Pending' or 'In Progress'
    - converted_salons: count of salons where lead_status == 'Converted'
    - total_sales: sum of total_amount from sales_opportunities table
    """
    try:
        db = get_supabase()
        salons = db.table("salons").select("salon_id, lead_status").execute().data or []
        users = db.table("users").select("id, role").execute().data or []
        visits = db.table("visits").select("id, status").execute().data or []
        sales = db.table("sales_opportunities").select("total_amount").execute().data or []

        total_salons = len(salons)
        total_executives = len([u for u in users if u.get("role") == "executive"])
        completed_visits = len([v for v in visits if v.get("status") == "Completed"])
        pending_visits = len([v for v in visits if v.get("status") in ["Pending", "In Progress"]])
        converted_salons = len([s for s in salons if s.get("lead_status") in ["Converted", "Completed"]])
        total_sales = sum([float(s.get("total_amount") or 0) for s in sales])

        return {
            # snake_case (matching API specification)
            "total_salons": total_salons,
            "total_executives": total_executives,
            "completed_visits": completed_visits,
            "pending_visits": pending_visits,
            "converted_salons": converted_salons,
            "total_sales": round(total_sales, 2),
            # camelCase aliases for React UI components
            "totalSalons": total_salons,
            "totalExecutives": total_executives,
            "completedVisits": completed_visits,
            "pendingVisits": pending_visits,
            "convertedSalons": converted_salons,
            "totalSales": round(total_sales, 2)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute dashboard summary: {str(e)}"
        )
