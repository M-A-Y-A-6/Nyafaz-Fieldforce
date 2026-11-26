from typing import Optional
from supabase import create_client, Client
from app.config import settings

_supabase_client: Optional[Client] = None

def get_supabase() -> Client:
    """
    Returns the singleton Supabase client initialized with the service role key.
    Uses lazy initialization to ensure configuration is loaded first.
    """
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            supabase_url=settings.SUPABASE_URL,
            supabase_key=settings.SUPABASE_SERVICE_ROLE_KEY
        )
    return _supabase_client

class _SupabaseProxy:
    """Convenience proxy allowing direct `supabase.table(...)` attribute access."""
    def __getattr__(self, name: str):
        return getattr(get_supabase(), name)

supabase = _SupabaseProxy()
