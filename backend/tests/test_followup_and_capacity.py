import os
import sys
from datetime import date, timedelta
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database import get_supabase
from app.security import create_access_token

client = TestClient(app)

def test_follow_up_scheduling_and_capacity():
    print("--- 1. Authenticate Demo Users ---")
    login_manager_res = client.post("/api/auth/login", json={
        "email": "manager@nyafaz-demo.com",
        "password": "Demo@123"
    })
    assert login_manager_res.status_code == 200, f"Manager login failed: {login_manager_res.text}"
    manager_token = login_manager_res.json()["access_token"]
    manager_headers = {"Authorization": f"Bearer {manager_token}"}

    login_exec_res = client.post("/api/auth/login", json={
        "email": "priya@nyafaz-demo.com",
        "password": "Demo@123"
    })
    assert login_exec_res.status_code == 200, f"Executive login failed: {login_exec_res.text}"
    exec_data = login_exec_res.json()["user"]
    exec_id = exec_data["id"]
    exec_token = login_exec_res.json()["access_token"]
    exec_headers = {"Authorization": f"Bearer {exec_token}"}
    exec_name = exec_data.get("full_name") or exec_data.get("name")
    print(f"Executive authenticated: {exec_name} ({exec_id})")

    db = get_supabase()

    # Dates
    today = date.today()
    past_date = (today - timedelta(days=1)).isoformat()
    alloc_date = (today + timedelta(days=3)).isoformat()
    future_date = (today + timedelta(days=5)).isoformat()
    overbooked_date = (today + timedelta(days=6)).isoformat()

    # Clean up any preexisting test visits on alloc_date, future_date & overbooked_date
    db.table("visits").delete().eq("executive_id", exec_id).eq("scheduled_date", alloc_date).execute()
    db.table("visits").delete().eq("executive_id", exec_id).eq("scheduled_date", future_date).execute()
    db.table("visits").delete().eq("executive_id", exec_id).eq("scheduled_date", overbooked_date).execute()

    print("\n--- 2. Allocate an Initial Visit ---")
    allocate_res = client.post("/api/visits/allocate", headers=manager_headers, json={
        "salon_name": "Test Followup Salon",
        "owner_name": "Test Owner",
        "contact_number": "9988776655",
        "address": "123 Test Road",
        "city": "Bengaluru",
        "executive_id": exec_id,
        "scheduled_date": alloc_date
    })
    assert allocate_res.status_code == 200, f"Allocate failed: {allocate_res.text}"
    allocated_visit = allocate_res.json()["visit"]
    visit_id = allocated_visit["id"]
    salon_id = allocated_visit["salon_id"]
    assert allocated_visit.get("visit_type") == "Initial"
    print(f"Allocated visit {visit_id} for salon {salon_id} with visit_type='Initial'")

    print("\n--- 3. Check-Out Validation: Missing follow_up_date ---")
    missing_date_res = client.post(f"/api/visits/{visit_id}/check-out", headers=exec_headers, json={
        "lat": 12.9716,
        "lng": 77.5946,
        "feedback": {
            "visit_outcome": "Follow-up Required",
            "customer_interest": "High",
            "notes": "Discussed pro package."
        }
    })
    assert missing_date_res.status_code == 400, f"Expected 400, got: {missing_date_res.status_code}"
    assert "Follow-up date is required" in missing_date_res.text
    print("Correctly rejected check-out with missing follow_up_date")

    print("\n--- 4. Check-Out Validation: Past or today follow_up_date ---")
    past_date_res = client.post(f"/api/visits/{visit_id}/check-out", headers=exec_headers, json={
        "lat": 12.9716,
        "lng": 77.5946,
        "follow_up_date": past_date,
        "feedback": {
            "visit_outcome": "Follow-up Required",
            "customer_interest": "High",
            "notes": "Discussed pro package.",
            "follow_up_date": past_date
        }
    })
    assert past_date_res.status_code == 400, f"Expected 400, got: {past_date_res.status_code}"
    assert "must be in the future" in past_date_res.text
    print("Correctly rejected check-out with past follow_up_date")

    print("\n--- 5. Check-Out Validation: 3 visits limit on overbooked_date ---")
    # Pre-populate 3 visits on overbooked_date
    for i in range(3):
        db.table("visits").insert({
            "salon_id": salon_id,
            "executive_id": exec_id,
            "scheduled_date": overbooked_date,
            "status": "Pending",
            "visit_type": "Initial"
        }).execute()

    overbooked_res = client.post(f"/api/visits/{visit_id}/check-out", headers=exec_headers, json={
        "lat": 12.9716,
        "lng": 77.5946,
        "follow_up_date": overbooked_date,
        "feedback": {
            "visit_outcome": "Follow-up Required",
            "customer_interest": "High",
            "notes": "Needs follow-up next week.",
            "follow_up_date": overbooked_date
        }
    })
    assert overbooked_res.status_code == 400, f"Expected 400, got: {overbooked_res.status_code}"
    expected_limit_msg = "You already have the maximum 3 visits scheduled on this date. Please pick another follow-up date."
    assert expected_limit_msg in overbooked_res.json().get("detail", ""), f"Mismatch error detail: {overbooked_res.text}"
    print("Correctly rejected check-out when 3 visits already scheduled on follow_up_date")

    print("\n--- 6. Successful Check-Out with Follow-up Scheduling ---")
    valid_checkout_res = client.post(f"/api/visits/{visit_id}/check-out", headers=exec_headers, json={
        "lat": 12.9716,
        "lng": 77.5946,
        "follow_up_date": future_date,
        "feedback": {
            "visit_outcome": "Follow-up Required",
            "customer_interest": "High",
            "notes": "Owner agreed to review contract next week.",
            "follow_up_date": future_date
        }
    })
    assert valid_checkout_res.status_code == 200, f"Valid checkout failed: {valid_checkout_res.text}"
    co_data = valid_checkout_res.json()
    assert co_data["status"] == "Completed"
    assert co_data["follow_up_date"] == future_date
    assert co_data["follow_up_visit"] is not None
    follow_up_visit = co_data["follow_up_visit"]
    assert follow_up_visit["scheduled_date"] == future_date
    assert follow_up_visit["status"] == "Pending"
    assert follow_up_visit["visit_type"] == "Follow-up"
    print(f"Visit completed! Follow-up visit created: {follow_up_visit['id']} with type='Follow-up' on {future_date}")

    # Check salon lead_status was updated to Interested
    salon_check = db.table("salons").select("lead_status").eq("salon_id", salon_id).single().execute().data
    assert salon_check["lead_status"] == "Interested", f"Expected Interested, got {salon_check['lead_status']}"
    print(f"Salon lead_status updated to '{salon_check['lead_status']}'")

    print("\n--- 7. Test GET /api/visits filtering ---")
    # Query with executive_id and date
    filtered_visits_res = client.get(f"/api/visits?executive_id={exec_id}&date={future_date}", headers=manager_headers)
    assert filtered_visits_res.status_code == 200
    visits_on_date = filtered_visits_res.json()
    assert len(visits_on_date) >= 1
    found_fu = next((v for v in visits_on_date if v["id"] == follow_up_visit["id"]), None)
    assert found_fu is not None, "Follow-up visit not found in filtered GET /api/visits query"
    assert found_fu["visit_type"] == "Follow-up"
    assert found_fu["scheduled_date"] == future_date
    assert found_fu["status"] == "Pending"
    print(f"GET /api/visits?executive_id=...&date=... correctly returned follow-up visit with visit_type='Follow-up'")

    print("\n--- 8. Test GET /api/users capacity & daily task counts ---")
    users_res = client.get("/api/users", headers=manager_headers)
    assert users_res.status_code == 200
    executives = users_res.json()
    priya = next((e for e in executives if e["id"] == exec_id), None)
    assert priya is not None
    assert "daily_task_counts" in priya
    assert "blocked_dates" in priya
    assert future_date in priya["daily_task_counts"]
    assert priya["daily_task_counts"][future_date] >= 1
    assert overbooked_date in priya["blocked_dates"]
    print(f"Priya daily_task_counts: {priya['daily_task_counts']}")
    print(f"Priya blocked_dates (has overbooked_date): {priya['blocked_dates']}")

    # Clean up test rows
    db.table("visits").delete().eq("id", follow_up_visit["id"]).execute()
    db.table("visits").delete().eq("id", visit_id).execute()
    db.table("visits").delete().eq("executive_id", exec_id).eq("scheduled_date", overbooked_date).execute()
    db.table("salons").delete().eq("salon_id", salon_id).execute()
    print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_follow_up_scheduling_and_capacity()
