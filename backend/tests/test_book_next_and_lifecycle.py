import os
import sys
from datetime import date, timedelta
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database import get_supabase

client = TestClient(app)

def test_book_next_visit_and_lifecycle():
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
    print(f"Executive authenticated: {exec_data.get('full_name')} ({exec_id})")

    db = get_supabase()

    today = date.today()
    past_date = (today - timedelta(days=1)).isoformat()
    alloc_date = (today + timedelta(days=2)).isoformat()
    future_date = (today + timedelta(days=7)).isoformat()
    overbooked_date = (today + timedelta(days=8)).isoformat()

    # Pre-clean test dates
    db.table("visits").delete().eq("executive_id", exec_id).eq("scheduled_date", alloc_date).execute()
    db.table("visits").delete().eq("executive_id", exec_id).eq("scheduled_date", future_date).execute()
    db.table("visits").delete().eq("executive_id", exec_id).eq("scheduled_date", overbooked_date).execute()

    print("\n--- 2. Create Initial Salon & Allocate Visit ---")
    alloc_res = client.post("/api/visits/allocate", headers=manager_headers, json={
        "salon_name": "Lifecycle Test Salon",
        "owner_name": "Owner Life",
        "contact_number": "9876543210",
        "address": "456 Main Blvd",
        "city": "Bengaluru",
        "executive_id": exec_id,
        "scheduled_date": alloc_date
    })
    assert alloc_res.status_code == 200, f"Allocate failed: {alloc_res.text}"
    alloc_data = alloc_res.json()["visit"]
    visit_id = alloc_data["id"]
    salon_id = alloc_data["salon_id"]
    assert alloc_data.get("lead_status") == "Visit Scheduled"
    print(f"Visit created: {visit_id} for salon {salon_id} with lead_status='Visit Scheduled'")

    print("\n--- 3. Verify Before Check-In State ---")
    # Verify via GET /api/visits that check_in_time is null and lead_status is Visit Scheduled
    get_v_res = client.get(f"/api/visits?executive_id={exec_id}&date={alloc_date}", headers=exec_headers)
    assert get_v_res.status_code == 200
    my_visit = next((v for v in get_v_res.json() if v["id"] == visit_id), None)
    assert my_visit is not None
    assert my_visit.get("check_in_time") is None
    assert my_visit.get("lead_status") == "Visit Scheduled"
    print("Verified: Before check-in, lead_status is 'Visit Scheduled' and check_in_time is null")

    print("\n--- 4. Test POST /api/visits/book-next Validation ---")
    # 4a. Past date validation
    past_book_res = client.post("/api/visits/book-next", headers=exec_headers, json={
        "salon_id": salon_id,
        "scheduled_date": past_date,
        "scheduled_time": "11:00 AM"
    })
    assert past_book_res.status_code == 400, f"Expected 400, got: {past_book_res.status_code}"
    assert "must be a future date" in past_book_res.text
    print("Correctly rejected past date for book-next")

    # 4b. Daily Limit of 3 on overbooked_date
    for i in range(3):
        db.table("visits").insert({
            "salon_id": salon_id,
            "executive_id": exec_id,
            "scheduled_date": overbooked_date,
            "status": "Pending",
            "visit_type": "Initial"
        }).execute()

    limit_book_res = client.post("/api/visits/book-next", headers=exec_headers, json={
        "salon_id": salon_id,
        "scheduled_date": overbooked_date,
        "scheduled_time": "11:00 AM"
    })
    assert limit_book_res.status_code == 400, f"Expected 400, got: {limit_book_res.status_code}"
    assert "maximum 3 visits scheduled on this date" in limit_book_res.text
    print("Correctly rejected book-next when 3 visits already scheduled on that date")

    # 4c. Successful book-next visit
    valid_book_res = client.post("/api/visits/book-next", headers=exec_headers, json={
        "salon_id": salon_id,
        "scheduled_date": future_date,
        "scheduled_time": "02:00 PM",
        "notes": "Follow up meeting to review package pricing.",
        "original_visit_id": visit_id
    })
    assert valid_book_res.status_code == 200, f"Book-next failed: {valid_book_res.text}"
    new_visit = valid_book_res.json()["visit"]
    new_visit_id = new_visit["id"]
    assert new_visit["scheduled_date"] == future_date
    assert new_visit["status"] == "Pending"
    assert new_visit["visit_type"] == "Follow-up"
    print(f"Successfully booked next visit {new_visit_id} on {future_date} with type='Follow-up'")

    # 4d. Duplicate book-next attempt must be rejected with 400
    dup_book_res = client.post("/api/visits/book-next", headers=exec_headers, json={
        "salon_id": salon_id,
        "scheduled_date": (today + timedelta(days=9)).isoformat(),
        "notes": "Attempt duplicate next visit"
    })
    assert dup_book_res.status_code == 400, f"Expected 400, got: {dup_book_res.status_code}"
    assert "Next slot is already booked for this visit." in dup_book_res.text
    print("Correctly rejected duplicate next visit booking: 'Next slot is already booked for this visit.'")

    print("\n--- 5. Verify Ordering and next_visit_booked in GET /api/visits ---")
    all_visits_res = client.get("/api/visits", headers=manager_headers)
    assert all_visits_res.status_code == 200
    all_visits = all_visits_res.json()
    assert len(all_visits) >= 2
    for i in range(len(all_visits) - 1):
        d1 = all_visits[i].get("scheduled_date") or ""
        d2 = all_visits[i + 1].get("scheduled_date") or ""
        assert d1 >= d2, f"Ordering violated: {d1} came before {d2}"
    print("Verified: GET /api/visits entries strictly ordered latest to oldest (scheduled_date desc)")

    orig_v = next((v for v in all_visits if v["id"] == visit_id), None)
    assert orig_v is not None
    assert orig_v.get("next_visit_booked") is True
    assert orig_v.get("follow_up_date") == future_date
    assert orig_v.get("created_at") is not None
    print(f"Verified: Original visit {visit_id} has next_visit_booked=True, follow_up_date={future_date}, created_at={orig_v.get('created_at')}")

    # Cleanup test records
    db.table("visits").delete().eq("id", new_visit_id).execute()
    db.table("visits").delete().eq("id", visit_id).execute()
    db.table("visits").delete().eq("executive_id", exec_id).eq("scheduled_date", overbooked_date).execute()
    db.table("salons").delete().eq("salon_id", salon_id).execute()
    print("\nALL LIFECYCLE AND BOOK-NEXT TESTS PASSED!")

if __name__ == "__main__":
    test_book_next_visit_and_lifecycle()
