import asyncio
import sys
import os
from datetime import date

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import HTTPException
from app.database import get_supabase
from app.routers.visits import allocate_visit, AllocateVisitRequest, get_visits
from app.routers.dashboard import get_dashboard_summary
from app.routers.salons import get_salons
from app.routers.users import list_executives

def run_tests():
    print("=================================================================")
    print("Testing Live Manager Endpoints and Task Allocation in Supabase")
    print("=================================================================")

    db = get_supabase()

    # Manager authentication context
    manager_context = {
        "id": "a0000000-0000-0000-0000-000000000001",
        "full_name": "Aarav Menon",
        "email": "manager@nyafaz-demo.com",
        "role": "manager"
    }

    # Executive authentication context (for authorization tests)
    executive_context = {
        "id": "a0000000-0000-0000-0000-000000000002",
        "full_name": "Priya Nair",
        "email": "priya@nyafaz-demo.com",
        "role": "executive"
    }

    # -------------------------------------------------------------------------
    # 1. Test Dashboard Summary before any modifications
    # -------------------------------------------------------------------------
    print("\n--- 1. Testing GET /api/dashboard/summary ---")
    summary = asyncio.run(get_dashboard_summary(current_user=manager_context))
    print("Initial dashboard summary:", summary)

    # Check required keys
    assert "total_salons" in summary
    assert "total_executives" in summary
    assert "completed_visits" in summary
    assert "pending_visits" in summary
    assert "converted_salons" in summary
    assert "total_sales" in summary
    # Check camelCase aliases
    assert "totalSalons" in summary
    assert "totalExecutives" in summary
    assert "completedVisits" in summary
    assert "pendingVisits" in summary
    assert "convertedSalons" in summary
    assert "totalSales" in summary

    initial_salons = summary["total_salons"]
    initial_pending = summary["pending_visits"]
    print(f"[✓] Dashboard summary returned live Supabase metrics: {initial_salons} salons, {initial_pending} pending visits")

    # -------------------------------------------------------------------------
    # 2. Test Sales Executives List & Metrics
    # -------------------------------------------------------------------------
    print("\n--- 2. Testing GET /api/users & /api/users/executives ---")
    executives = asyncio.run(list_executives(current_user=manager_context))
    print(f"Retrieved {len(executives)} executives:")
    for ex in executives:
        print(f"  - {ex.full_name}: assigned={ex.assigned_visits}, pending={ex.pending_visits}, completed={ex.completed_visits}, conversions={ex.conversions}")
        assert ex.role == "executive"
        assert hasattr(ex, "pending_visits")
        assert hasattr(ex, "assigned_visits")
        assert hasattr(ex, "completed_visits")
        assert hasattr(ex, "conversions")
    
    # Check ordering by full_name
    names = [ex.full_name for ex in executives]
    assert names == sorted(names), f"Executives not ordered by full_name: {names}"
    print("[✓] Executives list properly ordered with assigned, pending, completed, and conversion metrics!")

    # -------------------------------------------------------------------------
    # 3. Test Task Allocation (POST /api/visits/allocate)
    # -------------------------------------------------------------------------
    print("\n--- 3. Testing POST /api/visits/allocate ---")
    target_exec_id = executives[0].id
    test_date = f"2026-12-{os.getpid() % 28 + 1:02d}"
    test_salon_id = f"SAL-TEST-{os.getpid()}"

    alloc_req = AllocateVisitRequest(
        salon_id=test_salon_id,
        salon_name="Test Automation Spa & Salon",
        owner_name="Test Owner",
        contact_number="+91 99999 88888",
        email="test@automationspa.com",
        address="100 Test Blvd, Tech Park",
        city="Bengaluru",
        num_branches=2,
        executive_id=target_exec_id,
        scheduled_date=test_date,
        scheduled_time="11:30 AM"
    )

    created_res = asyncio.run(allocate_visit(alloc_req, current_user=manager_context))
    print("Allocated visit response:", created_res)
    assert created_res["success"] is True
    assert "visit" in created_res
    visit_data = created_res["visit"]
    assert visit_data["salon_id"] == test_salon_id
    assert visit_data["executive_id"] == target_exec_id
    assert visit_data["scheduled_date"] == test_date
    assert visit_data["status"] == "Pending"
    assert visit_data["salon_name"] == "Test Automation Spa & Salon"
    assert visit_data["lead_status"] == "Visit Scheduled"
    created_visit_id = visit_data["id"]
    print("[✓] Visit created in Supabase with status='Pending' joined with salon record!")

    # Verify salon was inserted with lead_status = 'Visit Scheduled'
    salon_in_db = db.table("salons").select("*").eq("salon_id", test_salon_id).single().execute().data
    assert salon_in_db is not None
    assert salon_in_db["lead_status"] == "Visit Scheduled"
    assert salon_in_db["assigned_executive_id"] == target_exec_id
    assert salon_in_db["salon_name"] == "Test Automation Spa & Salon"
    print("[✓] Salon inserted with lead_status='Visit Scheduled' and assigned_executive_id set!")

    # -------------------------------------------------------------------------
    # 4. Verify Immediate Real-Time Updates Across All Manager Endpoints
    # -------------------------------------------------------------------------
    print("\n--- 4. Verifying Real-Time Metric Updates Across Endpoints ---")
    
    # Dashboard summary update
    updated_summary = asyncio.run(get_dashboard_summary(current_user=manager_context))
    print("Updated dashboard summary:", updated_summary)
    assert updated_summary["total_salons"] == initial_salons + 1, f"Expected {initial_salons + 1}, got {updated_summary['total_salons']}"
    assert updated_summary["pending_visits"] == initial_pending + 1, f"Expected {initial_pending + 1}, got {updated_summary['pending_visits']}"
    print("[✓] Dashboard summary immediately reflected +1 total_salons and +1 pending_visits!")

    # Executives list update
    updated_executives = asyncio.run(list_executives(current_user=manager_context))
    updated_target_exec = next(e for e in updated_executives if e.id == target_exec_id)
    prev_target_exec = next(e for e in executives if e.id == target_exec_id)
    assert updated_target_exec.assigned_visits == prev_target_exec.assigned_visits + 1
    assert updated_target_exec.pending_visits == prev_target_exec.pending_visits + 1
    print(f"[✓] Executive {updated_target_exec.full_name} metrics immediately updated (+1 assigned, +1 pending)!")

    # Salons master list update
    salons_list = asyncio.run(get_salons(current_user=manager_context))
    assert len(salons_list) > 0
    # First salon should be our newly created salon since ordered by created_at desc
    new_salon_in_list = next((s for s in salons_list if s["salon_id"] == test_salon_id), None)
    assert new_salon_in_list is not None, "New salon not found in GET /api/salons"
    assert new_salon_in_list["assigned_executive_name"] == updated_target_exec.full_name
    assert new_salon_in_list["latest_visit_status"] == "Pending"
    assert new_salon_in_list["latest_scheduled_date"] == test_date
    print("[✓] GET /api/salons returns newly created salon enriched with executive name, status='Pending', and scheduled_date!")

    # -------------------------------------------------------------------------
    # 5. Test Daily Assignment Limit Enforcement (max 3 per executive per day)
    # -------------------------------------------------------------------------
    print("\n--- 5. Testing Daily Assignment Limit Enforcement (limit=3) ---")
    # We already have 1 visit on test_date. Let's add 2 more so total is 3:
    for i in range(2, 4):
        req = AllocateVisitRequest(
            salon_id=f"SAL-TEST-LIMIT-{os.getpid()}-{i}",
            salon_name=f"Limit Test Salon {i}",
            address=f"Address {i}",
            city="Pune",
            executive_id=target_exec_id,
            scheduled_date=test_date
        )
        res = asyncio.run(allocate_visit(req, current_user=manager_context))
        assert res["success"] is True

    # 4th allocation on test_date must raise HTTPException 400
    try:
        excess_req = AllocateVisitRequest(
            salon_id=f"SAL-TEST-EXCESS-{os.getpid()}",
            salon_name="Excess Salon",
            address="Excess Address",
            city="Pune",
            executive_id=target_exec_id,
            scheduled_date=test_date
        )
        asyncio.run(allocate_visit(excess_req, current_user=manager_context))
        assert False, "4th allocation should have raised HTTP 400 limit exception!"
    except HTTPException as e:
        print(f"Correctly caught limit exception: HTTP {e.status_code} - {e.detail}")
        assert e.status_code == 400
        assert "Daily assignment limit reached" in e.detail
        print("[✓] Strict daily assignment limit enforcement passed!")

    # -------------------------------------------------------------------------
    # 6. Test Mandatory City Validation (blank / whitespace city rejection)
    # -------------------------------------------------------------------------
    print("\n--- 6. Testing Mandatory City Validation ---")
    from pydantic import ValidationError

    # Missing city
    try:
        AllocateVisitRequest(
            salon_id="SAL-FAIL-1",
            salon_name="Missing City Salon",
            address="Some Address",
            executive_id=target_exec_id,
            scheduled_date=test_date
        )
        assert False, "Missing city should have failed Pydantic validation!"
    except ValidationError as e:
        print("[✓] Correctly rejected request with missing city")

    # Blank / whitespace city
    try:
        AllocateVisitRequest(
            salon_id="SAL-FAIL-2",
            salon_name="Blank City Salon",
            address="Some Address",
            city="   ",
            executive_id=target_exec_id,
            scheduled_date=test_date
        )
        assert False, "Whitespace city should have failed Pydantic validation!"
    except ValidationError as e:
        print("[✓] Correctly rejected request with whitespace city")

    # -------------------------------------------------------------------------
    # 7. Clean up temporary test data
    # -------------------------------------------------------------------------
    print("\n--- 7. Cleaning Up Temporary Test Records ---")
    db.table("visits").delete().eq("scheduled_date", test_date).execute()
    db.table("salons").delete().eq("salon_id", test_salon_id).execute()
    for i in range(2, 4):
        db.table("salons").delete().eq("salon_id", f"SAL-TEST-LIMIT-{os.getpid()}-{i}").execute()
    print("[✓] Cleanup complete.")

    print("\n=================================================================")
    print("ALL MANAGER ENDPOINTS & SUPABASE TASK ALLOCATION TESTS PASSED!")
    print("=================================================================")

if __name__ == "__main__":
    run_tests()
