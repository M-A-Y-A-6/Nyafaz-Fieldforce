import asyncio
import sys
import os

# Add backend to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app, health_check
from app.security import get_password_hash, verify_password, create_access_token, decode_access_token

def test_backend():
    print("--- Running Backend Validation Tests ---")
    
    # 1. Test password hashing
    hashed = get_password_hash("Demo@123")
    assert verify_password("Demo@123", hashed), "Password verification failed"
    assert not verify_password("WrongPass", hashed), "Invalid password check failed"
    print("[✓] Bcrypt password hashing & verification passed")

    # 2. Test JWT token generation and decoding
    token = create_access_token(user_id="a0000000-0000-0000-0000-000000000001", role="manager")
    payload = decode_access_token(token)
    assert payload is not None, "Failed to decode access token"
    assert payload["sub"] == "a0000000-0000-0000-0000-000000000001", "User ID mismatch in JWT"
    assert payload["role"] == "manager", "Role mismatch in JWT"
    print("[✓] JWT creation & payload decoding passed")

    # 3. Test health check endpoint directly
    health_result = asyncio.run(health_check())
    assert health_result["status"] == "healthy", "Health check status mismatch"
    print("[✓] GET /api/health endpoint passed:", health_result)

    # 4. Check all registered routes via OpenAPI schema
    openapi_schema = app.openapi()
    registered_paths = list(openapi_schema["paths"].keys())
    required_routes = [
        "/api/health",
        "/api/auth/login",
        "/api/auth/me",
        "/api/users",
        "/api/users/executives",
        "/api/salons",
        "/api/salons/{salon_id}/status",
        "/api/visits",
        "/api/visits/allocate",
        "/api/visits/{visit_id}/check-in",
        "/api/visits/{visit_id}/check-out",
        "/api/sales",
        "/api/dashboard/summary"
    ]
    for required_route in required_routes:
        assert required_route in registered_paths, f"Missing route: {required_route}"
    print("[✓] All required API routes registered in OpenAPI schema:", registered_paths)

    print("\n--- All Backend Validation Tests Passed Successfully! ---")

if __name__ == "__main__":
    test_backend()
