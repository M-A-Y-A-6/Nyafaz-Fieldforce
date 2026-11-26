from datetime import datetime, date as py_date, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator
from fastapi import APIRouter, HTTPException, status, Depends
from app.database import get_supabase
from app.security import get_current_user, require_manager
from app.config import settings

router = APIRouter()

today_str = py_date.today().isoformat()

class AllocateVisitRequest(BaseModel):
    salon_id: Optional[str] = None
    salon_name: Optional[str] = None
    owner_name: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: str = Field(..., min_length=1, description="City is mandatory and cannot be empty")
    num_branches: Optional[int] = None
    
    executive_id: str
    scheduled_date: str
    scheduled_time: Optional[str] = None
    salon_data: Optional[Dict[str, Any]] = None

    @field_validator("city")
    @classmethod
    def validate_city(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("City must be a non-empty string")
        return v.strip()

class CheckInRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    time: Optional[str] = None
    date: Optional[str] = None
    status_text: Optional[str] = "GPS Verified"

class FeedbackPayload(BaseModel):
    visit_outcome: str
    customer_interest: str
    notes: Optional[str] = ""
    remarks: Optional[str] = ""
    lead_status: Optional[str] = None
    follow_up_date: Optional[py_date] = None

class CheckOutRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    time: Optional[str] = None
    date: Optional[str] = None
    status_text: Optional[str] = "GPS Verified"
    follow_up_date: Optional[py_date] = None
    feedback: FeedbackPayload

class BookNextVisitRequest(BaseModel):
    salon_id: str
    scheduled_date: str
    scheduled_time: Optional[str] = None
    executive_id: Optional[str] = None
    notes: Optional[str] = ""
    original_visit_id: Optional[str] = None

@router.get("", response_model=List[Dict[str, Any]])
async def get_visits(
    executive_id: Optional[str] = None,
    date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Fetch visits (all for manager, own for executive) enriched with salon & executive details. Supports filtering by executive_id and date."""
    try:
        db = get_supabase()
        query = db.table("visits").select("*, salons(*), users(full_name)")
        if current_user.get("role") == "executive":
            query = query.eq("executive_id", current_user["id"])
        elif executive_id:
            query = query.eq("executive_id", executive_id)

        if date:
            query = query.eq("scheduled_date", date)

        res = query.order("scheduled_date", desc=True).order("created_at", desc=True).execute()
        if res.data:
            # Pre-compute salons that have upcoming/pending or scheduled next visits
            salon_next_visits = {}
            for row in res.data:
                sid = row.get("salon_id")
                st = row.get("status")
                s_date = row.get("scheduled_date")
                if st in ["Pending", "In Progress"] or row.get("visit_type") == "Follow-up":
                    if sid not in salon_next_visits or s_date > salon_next_visits[sid]:
                        salon_next_visits[sid] = s_date

            formatted = []
            for v in res.data:
                salon_obj = v.get("salons") if isinstance(v.get("salons"), dict) else {}
                salon_name = salon_obj.get("salon_name") or v.get("salon_name") or "Salon"
                exec_name = v.get("users", {}).get("full_name") if isinstance(v.get("users"), dict) else v.get("executive_name") or "Sales Executive"
                sid = v.get("salon_id")
                
                check_in_obj = None
                if v.get("check_in_time") or v.get("check_in_lat"):
                    check_in_obj = {
                        "time": str(v.get("check_in_time") or ""),
                        "lat": v.get("check_in_lat"),
                        "lng": v.get("check_in_lng"),
                        "gps_verified": v.get("check_in_gps_verified", False),
                        "status_text": "GPS Verified" if v.get("check_in_gps_verified") else "GPS Unavailable"
                    }

                check_out_obj = None
                if v.get("check_out_time") or v.get("check_out_lat"):
                    check_out_obj = {
                        "time": str(v.get("check_out_time") or ""),
                        "lat": v.get("check_out_lat"),
                        "lng": v.get("check_out_lng"),
                        "gps_verified": v.get("check_out_gps_verified", False),
                        "status_text": "GPS Verified" if v.get("check_out_gps_verified") else "GPS Unavailable"
                    }

                feedback_obj = None
                if v.get("visit_outcome") or v.get("feedback"):
                    feedback_obj = {
                        "visit_outcome": v.get("visit_outcome"),
                        "customer_interest": v.get("customer_interest"),
                        "notes": v.get("feedback", ""),
                        "remarks": v.get("remarks", "")
                    }

                # Next visit booked indicator
                subsequent_date = salon_next_visits.get(sid)
                has_follow_up = bool(v.get("follow_up_date"))
                has_future_visit = bool(subsequent_date and v.get("id") and (v.get("status") == "Completed" or v.get("scheduled_date") < subsequent_date))
                next_visit_booked = has_follow_up or has_future_visit
                follow_up_date_str = str(v.get("follow_up_date")) if v.get("follow_up_date") else (subsequent_date if next_visit_booked else None)

                raw_status = salon_obj.get("lead_status") or v.get("lead_status") or "Visit Scheduled"
                has_checked_in = bool(v.get("check_in_time") or v.get("check_in_lat"))
                if not has_checked_in:
                    normalized_status = "Visit Scheduled"
                elif raw_status in ["Converted", "Completed"]:
                    normalized_status = "Completed"
                elif raw_status in ["Interested", "Proposal / Discussion"]:
                    normalized_status = "Interested"
                elif raw_status in ["Visited", "Not Interested", "Lost"]:
                    normalized_status = "Visited"
                else:
                    normalized_status = "Visited" if v.get("status") == "Completed" else "Visit Scheduled"

                v_copy = {**v}
                v_copy["salon_name"] = salon_name
                v_copy["address"] = salon_obj.get("address") or v.get("address") or ""
                v_copy["city"] = salon_obj.get("city") or v.get("city") or ""
                v_copy["lead_status"] = normalized_status
                v_copy["raw_lead_status"] = raw_status
                v_copy["executive_name"] = exec_name
                v_copy["visit_type"] = v.get("visit_type") or "Initial"
                v_copy["follow_up_date"] = follow_up_date_str
                v_copy["next_visit_booked"] = next_visit_booked
                v_copy["check_in"] = check_in_obj
                v_copy["check_out"] = check_out_obj
                v_copy["feedback"] = feedback_obj
                v_copy["scheduled_time"] = v.get("scheduled_time") or None
                v_copy["created_at"] = str(v.get("created_at") or "")
                v_copy["check_in_time"] = str(v.get("check_in_time")) if v.get("check_in_time") else None
                v_copy["check_out_time"] = str(v.get("check_out_time")) if v.get("check_out_time") else None
                formatted.append(v_copy)
            return formatted
        return []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch visits: {str(e)}"
        )

@router.post("/allocate")
@router.post("/assign")
async def allocate_visit(
    request: AllocateVisitRequest,
    current_user: Dict[str, Any] = Depends(require_manager)
):
    """
    Allocates a salon task with strict daily assignment limit enforcement.
    Protected by require_manager.
    - Resolves salon details from flat fields or salon_data
    - Validates executive daily visit limit (<= DAILY_ASSIGNMENT_LIMIT)
    - Upserts/inserts salon into salons table with assigned_executive_id = executive_id
      and lead_status = 'Visit Scheduled' (if new salon or currently 'New Lead')
    - Inserts new row into visits table with status = 'Pending'
    - Returns the created visit joined with its salon record
    """
    db = get_supabase()

    # 1. Validate executive existence
    exec_res = db.table("users").select("id, full_name, role").eq("id", request.executive_id).execute()
    if not exec_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sales executive with ID '{request.executive_id}' not found."
        )
    executive = exec_res.data[0]
    if executive.get("role") != "executive":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User '{executive.get('full_name')}' is not a sales executive."
        )

    # 2. Check existing visit count for this executive on this date
    limit = settings.DAILY_ASSIGNMENT_LIMIT
    existing_visits_res = db.table("visits").select("id").eq("executive_id", request.executive_id).eq("scheduled_date", request.scheduled_date).execute()
    existing_visits = existing_visits_res.data or []
    count = len(existing_visits)
    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Daily assignment limit reached: Executive already has {count} of {limit} maximum visits scheduled on {request.scheduled_date}."
        )

    # 3. Resolve salon details from flat fields or salon_data
    salon_data = request.salon_data or {}
    salon_id = request.salon_id or salon_data.get("salon_id")
    salon_name = request.salon_name or salon_data.get("salon_name")
    owner_name = request.owner_name or salon_data.get("owner_name") or "Owner"
    contact_number = request.contact_number or salon_data.get("contact_number") or ""
    email = request.email or salon_data.get("email")
    address = request.address or salon_data.get("address")
    raw_city = request.city or salon_data.get("city") or ""
    city = raw_city.strip()
    if not city:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="City must not be blank."
        )
    num_branches = request.num_branches or salon_data.get("num_branches") or 1

    if not salon_id:
        all_salons = db.table("salons").select("salon_id").execute().data or []
        existing_ids = {s.get("salon_id") for s in all_salons}
        idx = len(existing_ids) + 1
        while f"SAL-{idx:03d}" in existing_ids:
            idx += 1
        salon_id = f"SAL-{idx:03d}"

    # 4. Upsert/insert salon into salons table
    existing_salon_res = db.table("salons").select("*").eq("salon_id", salon_id).execute()
    if existing_salon_res.data and len(existing_salon_res.data) > 0:
        existing_salon = existing_salon_res.data[0]
        current_status = existing_salon.get("lead_status")
        # If it is a new salon or still 'New Lead', set lead_status = 'Visit Scheduled'
        target_status = "Visit Scheduled" if (not current_status or current_status == "New Lead") else current_status

        salon_update = {
            "assigned_executive_id": request.executive_id,
            "lead_status": target_status
        }
        if salon_name:
            salon_update["salon_name"] = salon_name
        if address:
            salon_update["address"] = address
        if city:
            salon_update["city"] = city
        if owner_name and owner_name != "Owner":
            salon_update["owner_name"] = owner_name
        if contact_number:
            salon_update["contact_number"] = contact_number
        if email:
            salon_update["email"] = email
        if num_branches:
            salon_update["num_branches"] = int(num_branches)

        db.table("salons").update(salon_update).eq("salon_id", salon_id).execute()
        salon_record = db.table("salons").select("*").eq("salon_id", salon_id).single().execute().data
    else:
        new_salon_record = {
            "salon_id": salon_id,
            "salon_name": salon_name or "New Salon",
            "owner_name": owner_name or "Owner",
            "contact_number": contact_number or "",
            "email": email,
            "address": address or "Address on record",
            "city": city or "",
            "num_branches": int(num_branches) if num_branches else 1,
            "lead_status": "Visit Scheduled",
            "assigned_executive_id": request.executive_id
        }
        insert_res = db.table("salons").insert(new_salon_record).execute()
        salon_record = insert_res.data[0] if insert_res.data else new_salon_record

    # 5. Insert new row into visits table with status = 'Pending'
    new_visit_payload = {
        "salon_id": salon_id,
        "executive_id": request.executive_id,
        "scheduled_date": request.scheduled_date,
        "status": "Pending",
        "visit_type": "Initial"
    }
    visit_insert_res = db.table("visits").insert(new_visit_payload).execute()
    if not visit_insert_res.data or len(visit_insert_res.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record visit in database."
        )
    created_visit = visit_insert_res.data[0]

    # 6. Return created visit joined with salon record
    joined_visit = {
        **created_visit,
        "scheduled_time": request.scheduled_time or None,
        "next_visit_booked": False,
        "salon_name": salon_record.get("salon_name", "Salon"),
        "owner_name": salon_record.get("owner_name", "Owner"),
        "contact_number": salon_record.get("contact_number", ""),
        "address": salon_record.get("address", ""),
        "city": salon_record.get("city", ""),
        "num_branches": salon_record.get("num_branches", 1),
        "lead_status": salon_record.get("lead_status", "Visit Scheduled"),
        "executive_name": executive.get("full_name", "Sales Executive"),
        "salons": salon_record,
        "salon": salon_record
    }

    return {
        "success": True,
        "visit": joined_visit,
        **joined_visit
    }

@router.post("/{visit_id}/check-in")
async def check_in_visit(
    visit_id: str,
    request: CheckInRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Records GPS check-in time and coordinates; sets status to 'In Progress'."""
    now_iso = datetime.now(timezone.utc).isoformat()
    is_gps = request.lat is not None and request.lng is not None

    update_payload = {
        "status": "In Progress",
        "check_in_time": now_iso,
        "check_in_lat": request.lat,
        "check_in_lng": request.lng,
        "check_in_gps_verified": is_gps
    }

    try:
        db = get_supabase()
        res = db.table("visits").update(update_payload).eq("id", visit_id).execute()
        if res.data and len(res.data) > 0:
            salon_id = res.data[0].get("salon_id")
            if salon_id:
                db.table("salons").update({"lead_status": "Visited"}).eq("salon_id", salon_id).execute()
            return res.data[0]
        raise HTTPException(status_code=404, detail=f"Visit with ID '{visit_id}' not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Check-in failed: {str(e)}")

@router.post("/{visit_id}/check-out")
async def check_out_visit(
    visit_id: str,
    request: CheckOutRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Records checkout with GPS coordinates, outcome, and mandatory feedback notes.
    If outcome is 'Follow-up Required':
    - Requires future follow_up_date
    - Validates executive daily capacity on follow_up_date (< DAILY_ASSIGNMENT_LIMIT)
    - Updates salon lead status to 'Interested' (or retains 'Proposal / Discussion')
    - Automatically creates a new scheduled follow-up visit (visit_type='Follow-up')
    """
    if not request.feedback.notes or not request.feedback.notes.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback notes are required to complete visit checkout."
        )

    visit_outcome = request.feedback.visit_outcome
    follow_up_date = request.follow_up_date or request.feedback.follow_up_date

    # Validate follow-up requirements
    if visit_outcome == "Follow-up Required":
        if not follow_up_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Follow-up date is required when outcome is 'Follow-up Required'."
            )
        if follow_up_date <= py_date.today():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Follow-up date must be in the future."
            )

    db = get_supabase()

    # Fetch current visit to verify existence and get executive_id & salon_id
    current_visit_res = db.table("visits").select("*").eq("id", visit_id).execute()
    if not current_visit_res.data or len(current_visit_res.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Visit with ID '{visit_id}' not found"
        )
    current_visit = current_visit_res.data[0]
    executive_id = current_visit.get("executive_id")
    salon_id = current_visit.get("salon_id")

    # If executive, verify ownership
    if current_user.get("role") == "executive" and str(executive_id) != str(current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to check out another executive's visit."
        )

    # Check capacity limit on follow-up date
    if visit_outcome == "Follow-up Required" and follow_up_date:
        existing_res = db.table("visits").select("id").eq("executive_id", executive_id).eq("scheduled_date", str(follow_up_date)).execute()
        existing_count = len(existing_res.data or [])
        if existing_count >= settings.DAILY_ASSIGNMENT_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have the maximum 3 visits scheduled on this date. Please pick another follow-up date."
            )

    now_iso = datetime.now(timezone.utc).isoformat()
    is_gps = request.lat is not None and request.lng is not None

    update_payload = {
        "status": "Completed",
        "check_out_time": now_iso,
        "check_out_lat": request.lat,
        "check_out_lng": request.lng,
        "check_out_gps_verified": is_gps,
        "visit_outcome": visit_outcome,
        "customer_interest": request.feedback.customer_interest,
        "feedback": request.feedback.notes.strip(),
        "remarks": request.feedback.remarks or ""
    }
    if follow_up_date:
        update_payload["follow_up_date"] = str(follow_up_date)

    try:
        res = db.table("visits").update(update_payload).eq("id", visit_id).execute()
        if not res.data or len(res.data) == 0:
            raise HTTPException(status_code=404, detail=f"Visit with ID '{visit_id}' not found")
        completed_visit = res.data[0]

        # Update salon lead status
        target_lead_status = None
        if salon_id:
            salon_res = db.table("salons").select("lead_status").eq("salon_id", salon_id).execute()
            current_lead_status = salon_res.data[0].get("lead_status") if (salon_res.data and len(salon_res.data) > 0) else None

            if current_lead_status in ["Converted", "Completed"] and request.feedback.lead_status not in ["Converted", "Completed"]:
                target_lead_status = "Converted"
            elif request.feedback.lead_status in ["Converted", "Completed"]:
                target_lead_status = "Converted"
            elif (
                visit_outcome == "Follow-up Required"
                or request.feedback.customer_interest in ["High", "Medium"]
                or request.feedback.lead_status in ["Interested", "Proposal / Discussion"]
            ):
                target_lead_status = "Interested"
            else:
                # Client not interested / general visit completed without buying interest
                target_lead_status = "Visited"

            db.table("salons").update({"lead_status": target_lead_status}).eq("salon_id", salon_id).execute()

        # Insert new scheduled follow-up visit if outcome is Follow-up Required
        follow_up_visit = None
        if visit_outcome == "Follow-up Required" and follow_up_date:
            follow_up_payload = {
                "salon_id": salon_id,
                "executive_id": executive_id,
                "scheduled_date": str(follow_up_date),
                "status": "Pending",
                "visit_type": "Follow-up"
            }
            follow_up_res = db.table("visits").insert(follow_up_payload).execute()
            if follow_up_res.data:
                follow_up_visit = follow_up_res.data[0]

        return {
            **completed_visit,
            "salon_lead_status": target_lead_status,
            "next_visit_booked": bool(follow_up_date),
            "follow_up_visit": follow_up_visit
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Check-out failed: {str(e)}")

@router.post("/book-next")
async def book_next_visit(
    request: BookNextVisitRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Schedules the next follow-up visit for a salon.
    - Validates scheduled_date is strictly in the future (> py_date.today())
    - Enforces DAILY_ASSIGNMENT_LIMIT (3) for the executive on that date
    - Prevents duplicate next-visit bookings: returns HTTP 400 ("Next slot is already booked for this visit.")
      if a subsequent visit is already scheduled for that salon
    - Inserts new visit into visits table with status = 'Pending' and visit_type = 'Follow-up'
    - Updates original visit with follow_up_date
    - Returns the created visit record
    """
    db = get_supabase()

    # Determine executive
    if current_user.get("role") == "executive":
        executive_id = current_user["id"]
    elif request.executive_id:
        executive_id = request.executive_id
    else:
        # Check assigned executive on salon
        salon_lookup = db.table("salons").select("assigned_executive_id").eq("salon_id", request.salon_id).execute()
        executive_id = salon_lookup.data[0].get("assigned_executive_id") if salon_lookup.data else current_user["id"]

    # Validate date format and future constraint
    try:
        sched_date = py_date.fromisoformat(request.scheduled_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Expected YYYY-MM-DD."
        )

    if sched_date <= py_date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Follow-up date must be a future date."
        )

    # Check daily limit of 3 visits per day
    existing_visits = db.table("visits").select("id").eq("executive_id", executive_id).eq("scheduled_date", str(sched_date)).execute().data or []
    if len(existing_visits) >= settings.DAILY_ASSIGNMENT_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have the maximum 3 visits scheduled on this date. Please pick another follow-up date."
        )

    # Prevent duplicate next-visit bookings: return HTTP 400 if a subsequent visit is already scheduled for that salon
    subsequent_query = db.table("visits").select("id, scheduled_date, status, visit_type") \
        .eq("salon_id", request.salon_id) \
        .in_("status", ["Pending", "In Progress"]) \
        .eq("visit_type", "Follow-up")
    if request.original_visit_id:
        subsequent_query = subsequent_query.neq("id", request.original_visit_id)
    existing_subsequent = subsequent_query.execute().data or []

    if not existing_subsequent and request.original_visit_id:
        orig_res = db.table("visits").select("follow_up_date").eq("id", request.original_visit_id).execute()
        if orig_res.data and orig_res.data[0].get("follow_up_date"):
            existing_subsequent = orig_res.data

    if existing_subsequent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Next slot is already booked for this visit."
        )

    # Verify salon existence
    salon_res = db.table("salons").select("*").eq("salon_id", request.salon_id).execute()
    if not salon_res.data or len(salon_res.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Salon with ID '{request.salon_id}' not found."
        )
    salon_record = salon_res.data[0]

    # Create new visit record
    new_visit_payload = {
        "salon_id": request.salon_id,
        "executive_id": executive_id,
        "scheduled_date": str(sched_date),
        "status": "Pending",
        "visit_type": "Follow-up"
    }
    if request.notes:
        new_visit_payload["remarks"] = request.notes

    visit_insert_res = db.table("visits").insert(new_visit_payload).execute()
    if not visit_insert_res.data or len(visit_insert_res.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to schedule next visit."
        )
    created_visit = visit_insert_res.data[0]

    # Update original visit's follow_up_date so it indicates next_visit_booked
    if request.original_visit_id:
        db.table("visits").update({"follow_up_date": str(sched_date)}).eq("id", request.original_visit_id).execute()
    else:
        recent_completed = db.table("visits").select("id").eq("salon_id", request.salon_id).eq("status", "Completed").order("scheduled_date", desc=True).limit(1).execute().data
        if recent_completed:
            db.table("visits").update({"follow_up_date": str(sched_date)}).eq("id", recent_completed[0]["id"]).execute()

    joined_visit = {
        **created_visit,
        "scheduled_time": request.scheduled_time or None,
        "next_visit_booked": False,
        "follow_up_date": None,
        "salon_name": salon_record.get("salon_name", "Salon"),
        "address": salon_record.get("address", ""),
        "city": salon_record.get("city", ""),
        "lead_status": salon_record.get("lead_status", "Visit Scheduled"),
        "salons": salon_record,
        "salon": salon_record
    }

    return {
        "success": True,
        "visit": joined_visit,
        **joined_visit
    }
