import os
import sys
from datetime import date, timedelta
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database import get_supabase

client = TestClient(app)

def test_salon_lead_status_mapping_and_checkout():
    print("--- 1. Authenticate Manager & Executive ---")
    login_mgr_res = client.post("/api/auth/login", json={
        "email": "manager@nyafaz-demo.com",
        "password": "Demo@123"
    })
    assert login_mgr_res.status_code == 200, f"Manager login failed: {login_mgr_res.text}"
    mgr_token = login_mgr_res.json()["access_token"]
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}

    login_exec_res = client.post("/api/auth/login", json={
        "email": "priya@nyafaz-demo.com",
        "password": "Demo@123"
    })
    assert login_exec_res.status_code == 200, f"Executive login failed: {login_exec_res.text}"
    exec_data = login_exec_res.json()["user"]
    exec_id = exec_data["id"]
    exec_token = login_exec_res.json()["access_token"]
    exec_headers = {"Authorization": f"Bearer {exec_token}"}

    db = get_supabase()
    today = date.today()
    target_date = (today + timedelta(days=10)).isoformat()
    follow_up_target = (today + timedelta(days=12)).isoformat()

    # Pre-clean test records on target_date
    db.table("visits").delete().eq("executive_id", exec_id).eq("scheduled_date", target_date).execute()
    db.table("visits").delete().eq("executive_id", exec_id).eq("scheduled_date", follow_up_target).execute()

    # --- Scenario A: Allocate salon -> status must be 'Visit Scheduled' ---
    print("\n--- 2. Allocate Salon & Verify 'Visit Scheduled' Status ---")
    alloc_res = client.post("/api/visits/allocate", headers=mgr_headers, json={
        "salon_name": "Lead Status Test Salon A",
        "owner_name": "Owner A",
        "contact_number": "9123456780",
        "address": "123 Status Lane",
        "city": "Bengaluru",
        "executive_id": exec_id,
        "scheduled_date": target_date
    })
    assert alloc_res.status_code == 200, f"Allocate failed: {alloc_res.text}"
    visit_a = alloc_res.json()["visit"]
    visit_a_id = visit_a["id"]
    salon_a_id = visit_a["salon_id"]

    # Check GET /api/salons for Salon A
    salons_res = client.get("/api/salons", headers=mgr_headers)
    assert salons_res.status_code == 200
    salons_list = salons_res.json()
    salon_a = next((s for s in salons_list if s["salon_id"] == salon_a_id), None)
    assert salon_a is not None
    assert salon_a["lead_status"] == "Visit Scheduled", f"Expected 'Visit Scheduled', got {salon_a['lead_status']}"
    assert salon_a["isCompleted"] is False
    print(f"Verified: Salon A has lead_status='Visit Scheduled' and isCompleted=False")

    # --- Scenario B: Check-in -> Check-out with 'Not Interested' / Low interest -> 'Visited' ---
    print("\n--- 3. Check-out with Low Interest -> Status must become 'Visited' ---")
    check_in_res = client.post(f"/api/visits/{visit_a_id}/check-in", headers=exec_headers, json={
        "lat": 12.9716,
        "lng": 77.5946
    })
    assert check_in_res.status_code == 200

    checkout_res = client.post(f"/api/visits/{visit_a_id}/check-out", headers=exec_headers, json={
        "lat": 12.9716,
        "lng": 77.5946,
        "feedback": {
            "visit_outcome": "Successful",
            "customer_interest": "Low",
            "notes": "Client currently satisfied with existing vendor. No immediate interest."
        }
    })
    assert checkout_res.status_code == 200, f"Checkout failed: {checkout_res.text}"

    # Verify GET /api/salons returns 'Visited' and NOT 'Completed'
    salons_res = client.get("/api/salons", headers=mgr_headers)
    salons_list = salons_res.json()
    salon_a = next((s for s in salons_list if s["salon_id"] == salon_a_id), None)
    assert salon_a is not None
    assert salon_a["lead_status"] == "Visited", f"Expected 'Visited', got {salon_a['lead_status']}"
    assert salon_a["isCompleted"] is False, "Salon marked Completed merely because visit finished!"
    print(f"Verified: After not interested checkout, Salon A has lead_status='Visited' and isCompleted=False")

    # --- Scenario C: Allocate Salon B -> Check-in -> Check-out with 'Follow-up Required' -> 'Interested' ---
    print("\n--- 4. Allocate Salon B & Check-out with Follow-up -> Status must become 'Interested' ---")
    alloc_b = client.post("/api/visits/allocate", headers=mgr_headers, json={
        "salon_name": "Lead Status Test Salon B",
        "owner_name": "Owner B",
        "contact_number": "9123456781",
        "address": "456 Proposal Road",
        "city": "Bengaluru",
        "executive_id": exec_id,
        "scheduled_date": target_date
    })
    assert alloc_b.status_code == 200
    visit_b_id = alloc_b.json()["visit"]["id"]
    salon_b_id = alloc_b.json()["visit"]["salon_id"]

    client.post(f"/api/visits/{visit_b_id}/check-in", headers=exec_headers, json={"lat": 12.97, "lng": 77.59})
    checkout_b = client.post(f"/api/visits/{visit_b_id}/check-out", headers=exec_headers, json={
        "lat": 12.97,
        "lng": 77.59,
        "follow_up_date": follow_up_target,
        "feedback": {
            "visit_outcome": "Follow-up Required",
            "customer_interest": "High",
            "notes": "Client wants custom package proposal."
        }
    })
    assert checkout_b.status_code == 200

    salons_res = client.get("/api/salons", headers=mgr_headers)
    salon_b = next((s for s in salons_res.json() if s["salon_id"] == salon_b_id), None)
    assert salon_b is not None
    assert salon_b["lead_status"] == "Interested", f"Expected 'Interested', got {salon_b['lead_status']}"
    assert salon_b["isCompleted"] is False
    print(f"Verified: After follow-up checkout, Salon B has lead_status='Interested' and isCompleted=False")

    # --- Scenario D: Update lead_status to 'Converted' / 'Completed' -> 'Completed' ---
    print("\n--- 5. Mark Deal Closed -> Status must become 'Completed' ---")
    status_patch = client.patch(f"/api/salons/{salon_b_id}/status", headers=mgr_headers, json={
        "lead_status": "Completed"
    })
    assert status_patch.status_code == 200

    salons_res = client.get("/api/salons", headers=mgr_headers)
    salon_b = next((s for s in salons_res.json() if s["salon_id"] == salon_b_id), None)
    assert salon_b is not None
    assert salon_b["lead_status"] == "Completed", f"Expected 'Completed', got {salon_b['lead_status']}"
    assert salon_b["isCompleted"] is True
    print(f"Verified: After deal finalized, Salon B has lead_status='Completed' and isCompleted=True")

    # --- Cleanup ---
    print("\n--- 6. Clean up test records ---")
    db.table("visits").delete().eq("salon_id", salon_a_id).execute()
    db.table("visits").delete().eq("salon_id", salon_b_id).execute()
    db.table("salons").delete().eq("salon_id", salon_a_id).execute()
    db.table("salons").delete().eq("salon_id", salon_b_id).execute()
    print("ALL LEAD STATUS TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_salon_lead_status_mapping_and_checkout()
