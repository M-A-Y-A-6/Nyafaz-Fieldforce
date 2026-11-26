from collections import defaultdict
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator
from fastapi import APIRouter, HTTPException, status, Depends
from app.database import get_supabase
from app.security import get_current_user

router = APIRouter()

def map_salon_lead_status(raw_status: Optional[str], has_sale: bool = False, assigned_exec_id: Optional[str] = None) -> str:
    """
    Normalizes salon lead status according to exact business rules:
    - Completed: Only when deal is closed/converted (or sale finalized)
    - Interested: When client is interested / in proposal discussion
    - Visited: When visit completed with no buying interest (normalizes 'Not Interested' -> 'Visited')
    - Visit Scheduled: Default when salon is assigned and not yet visited
    """
    status_clean = (raw_status or "").strip()
    if status_clean in ["Converted", "Completed"] or has_sale:
        return "Completed"
    if status_clean in ["Interested", "Proposal / Discussion"]:
        return "Interested"
    if status_clean in ["Visited", "Not Interested", "Lost"]:
        return "Visited"
    return "Visit Scheduled"

class SalonStatusUpdate(BaseModel):
    lead_status: str
    assigned_executive_id: Optional[str] = None

class SalonCreate(BaseModel):
    salon_id: Optional[str] = None
    salon_name: str
    owner_name: Optional[str] = "Owner"
    contact_number: Optional[str] = ""
    email: Optional[str] = None
    address: str
    city: str = Field(..., min_length=1, description="City is mandatory and cannot be empty")
    num_branches: Optional[int] = 1
    lead_status: Optional[str] = "New Lead"
    assigned_executive_id: Optional[str] = None

    @field_validator("city")
    @classmethod
    def validate_city(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("City must be a non-empty string")
        return v.strip()

@router.get("", response_model=List[Dict[str, Any]])
async def get_salons(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Fetch all salons ordered by created_at descending, enriched with:
    - assigned executive's name
    - latest visit status and scheduled_date
    - latest feedback details (visit_outcome, customer_interest, notes, remarks)
    - check-in and check-out timestamps
    - sales details from sales_opportunities
    """
    try:
        db = get_supabase()
        salons_res = db.table("salons").select("*").order("created_at", desc=True).execute()
        salons = salons_res.data or []

        if not salons:
            return []

        # Fetch users to map executive names
        users_res = db.table("users").select("id, full_name, email").execute()
        users = users_res.data or []
        exec_map = {str(u["id"]): u["full_name"] for u in users}

        # Fetch visits ordered by scheduled_date desc, created_at desc
        visits_res = db.table("visits").select("*").order("scheduled_date", desc=True).order("created_at", desc=True).execute()
        visits = visits_res.data or []
        visits_by_salon = defaultdict(list)
        for v in visits:
            visits_by_salon[v.get("salon_id")].append(v)

        # Fetch sales opportunities
        sales_res = db.table("sales_opportunities").select("*").order("sales_date", desc=True).order("created_at", desc=True).execute()
        sales = sales_res.data or []
        sales_by_salon = {}
        for s in sales:
            s_salon_id = s.get("salon_id")
            if s_salon_id and s_salon_id not in sales_by_salon:
                sales_by_salon[s_salon_id] = s

        enriched = []
        for salon in salons:
            salon_id = salon["salon_id"]
            assigned_exec_id = str(salon.get("assigned_executive_id") or "")
            exec_name = exec_map.get(assigned_exec_id)

            salon_visits = visits_by_salon.get(salon_id, [])
            completed_visit = next((v for v in salon_visits if v.get("status") == "Completed"), None)
            latest_visit = salon_visits[0] if salon_visits else None

            # Prioritize completed visit for feedback & checkout timestamps if available, otherwise latest
            visit_for_feedback = completed_visit or latest_visit

            feedback_obj = None
            if visit_for_feedback and (visit_for_feedback.get("visit_outcome") or visit_for_feedback.get("feedback")):
                feedback_obj = {
                    "visit_outcome": visit_for_feedback.get("visit_outcome"),
                    "customer_interest": visit_for_feedback.get("customer_interest"),
                    "notes": visit_for_feedback.get("feedback") or "",
                    "remarks": visit_for_feedback.get("remarks") or ""
                }

            check_in_obj = None
            if visit_for_feedback and (visit_for_feedback.get("check_in_time") or visit_for_feedback.get("check_in_lat")):
                check_in_obj = {
                    "time": str(visit_for_feedback.get("check_in_time") or ""),
                    "lat": visit_for_feedback.get("check_in_lat"),
                    "lng": visit_for_feedback.get("check_in_lng"),
                    "gps_verified": visit_for_feedback.get("check_in_gps_verified", False),
                    "status_text": "GPS Verified" if visit_for_feedback.get("check_in_gps_verified") else "GPS Unavailable"
                }

            check_out_obj = None
            if visit_for_feedback and (visit_for_feedback.get("check_out_time") or visit_for_feedback.get("check_out_lat")):
                check_out_obj = {
                    "time": str(visit_for_feedback.get("check_out_time") or ""),
                    "lat": visit_for_feedback.get("check_out_lat"),
                    "lng": visit_for_feedback.get("check_out_lng"),
                    "gps_verified": visit_for_feedback.get("check_out_gps_verified", False),
                    "status_text": "GPS Verified" if visit_for_feedback.get("check_out_gps_verified") else "GPS Unavailable"
                }

            sale_record = sales_by_salon.get(salon_id)
            mapped_status = map_salon_lead_status(salon.get("lead_status"), bool(sale_record), assigned_exec_id)
            is_deal_completed = mapped_status == "Completed"

            item = {
                **salon,
                "lead_status": mapped_status,
                "raw_lead_status": salon.get("lead_status"),
                "assigned_executive_name": exec_name,
                "executive_name": exec_name,
                "latest_visit_status": latest_visit.get("status") if latest_visit else None,
                "visit_status": latest_visit.get("status") if latest_visit else None,
                "latest_scheduled_date": latest_visit.get("scheduled_date") if latest_visit else None,
                "scheduled_date": latest_visit.get("scheduled_date") if latest_visit else None,
                "latest_visit": latest_visit,
                "feedback": feedback_obj,
                "check_in": check_in_obj,
                "checkIn": check_in_obj,
                "check_out": check_out_obj,
                "checkOut": check_out_obj,
                "sale": sale_record,
                "sales_details": sale_record,
                "has_sale": bool(sale_record),
                "isCompleted": is_deal_completed,
                "is_completed": is_deal_completed
            }
            enriched.append(item)

        return enriched
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch salons: {str(e)}"
        )

@router.patch("/{salon_id}/status")
async def update_salon_status(
    salon_id: str,
    update: SalonStatusUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update lead status and optional assigned executive for a salon."""
    valid_statuses = [
        "New Lead", "Visit Scheduled", "Visited", "Interested",
        "Proposal / Discussion", "Converted", "Completed", "Lost", "Not Interested"
    ]
    if update.lead_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid lead status: {update.lead_status}. Must be one of {valid_statuses}"
        )

    # Normalize status for database storage
    if update.lead_status == "Completed":
        db_lead_status = "Converted"
    elif update.lead_status in ["Not Interested", "Lost"]:
        db_lead_status = "Visited"
    else:
        db_lead_status = update.lead_status

    update_payload = {"lead_status": db_lead_status}
    if update.assigned_executive_id is not None:
        update_payload["assigned_executive_id"] = update.assigned_executive_id

    try:
        db = get_supabase()
        res = db.table("salons").update(update_payload).eq("salon_id", salon_id).execute()
        if res.data and len(res.data) > 0:
            row = res.data[0]
            mapped = map_salon_lead_status(row.get("lead_status"))
            return {
                **row,
                "lead_status": mapped,
                "raw_lead_status": row.get("lead_status")
            }
        raise HTTPException(status_code=404, detail=f"Salon with ID '{salon_id}' not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update salon status: {str(e)}")

@router.post("", response_model=Dict[str, Any])
async def create_salon(
    salon: SalonCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create or upsert a salon record."""
    data = salon.model_dump()
    city = salon.city.strip()
    if not city:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="City must not be blank."
        )
    data["city"] = city
    db = get_supabase()

    if not data.get("salon_id"):
        all_salons = db.table("salons").select("salon_id").execute().data or []
        existing_ids = {s.get("salon_id") for s in all_salons}
        idx = len(existing_ids) + 1
        while f"SAL-{idx:03d}" in existing_ids:
            idx += 1
        data["salon_id"] = f"SAL-{idx:03d}"

    try:
        res = db.table("salons").upsert(data).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create salon: {str(e)}")
