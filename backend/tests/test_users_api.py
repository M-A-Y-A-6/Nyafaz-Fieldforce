import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_supabase
from app.security import create_access_token, verify_password
from app.routers.users import list_executives, create_executive, CreateExecutiveRequest
from fastapi import HTTPException

def test_users_api():
    print("--- Testing Users & Executive Management API ---")
    db = get_supabase()

    # Manager mock auth context
    manager_context = {
        "id": "a0000000-0000-0000-0000-000000000001",
        "full_name": "Aarav Menon",
        "email": "manager@nyafaz-demo.com",
        "role": "manager"
    }

    # 1. Test duplicate email validation
    print("\n1. Testing duplicate email rejection...")
    dup_request = CreateExecutiveRequest(
        full_name="Duplicate Priya",
        email="priya@nyafaz-demo.com",
        password="Password@123"
    )
    try:
        asyncio.run(create_executive(dup_request, current_user=manager_context))
        assert False, "Duplicate email should have raised HTTPException 400"
    except HTTPException as e:
        print(f"   Received status: {e.status_code}, detail: {e.detail}")
        assert e.status_code == 400, f"Expected 400, got {e.status_code}"
        assert e.detail == "An account with this email already exists.", f"Expected exact message, got: {e.detail}"
        print("   [✓] Correct duplicate error message returned!")

    # 2. Test successful creation of new executive
    test_email = f"test.exec.{os.getpid()}@nyafaz-demo.com"
    print(f"\n2. Testing creation of new executive with email: {test_email}...")
    new_request = CreateExecutiveRequest(
        full_name="Ananya Sharma",
        email=test_email,
        password="SecurePassword@123"
    )
    created = asyncio.run(create_executive(new_request, current_user=manager_context))
    print("   Created response:", created.model_dump())
    assert created.full_name == "Ananya Sharma"
    assert created.email == test_email
    assert created.role == "executive"
    assert created.id is not None
    assert created.created_at is not None
    print("   [✓] Executive created with HTTP 201 schema { id, full_name, email, role, created_at }!")

    # Verify password hash in DB
    db_user = db.table("users").select("*").eq("id", created.id).single().execute()
    assert db_user.data is not None
    assert verify_password("SecurePassword@123", db_user.data["password_hash"])
    print("   [✓] Password successfully hashed and verified via bcrypt!")

    # 3. Test listing executives ordered by full_name
    print("\n3. Testing GET /api/users listing...")
    executives = asyncio.run(list_executives(current_user=manager_context))
    print(f"   Retrieved {len(executives)} executives:")
    for ex in executives:
        print(f"    - {ex.full_name} ({ex.email}) | assigned: {ex.assigned_visits}, completed: {ex.completed_visits}, conversions: {ex.conversions}")

    # Check ordering by full_name
    names = [ex.full_name for ex in executives]
    assert names == sorted(names), f"Executives are not ordered by full_name: {names}"
    print("   [✓] Executives are properly ordered by full_name!")

    # Verify the newly created executive is in the list
    new_in_list = next((ex for ex in executives if ex.id == created.id), None)
    assert new_in_list is not None, "Newly created executive not found in GET /api/users"
    assert new_in_list.assigned_visits == 0
    assert new_in_list.completed_visits == 0
    assert new_in_list.conversions == 0
    print("   [✓] Newly created executive appears immediately in the list with performance metrics!")

    # Clean up test user from DB
    db.table("users").delete().eq("id", created.id).execute()
    print("   [✓] Cleaned up temporary test user.")

    print("\n--- All Users API Tests Passed Successfully! ---")

if __name__ == "__main__":
    test_users_api()
