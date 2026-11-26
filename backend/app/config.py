import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    SUPABASE_URL: str = Field(default="https://dummy-project.supabase.co")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(default="dummy-service-role-key")
    JWT_SECRET: str = Field(default="super-secret-jwt-key-change-in-production-min-32-chars")
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=1440)
    DAILY_ASSIGNMENT_LIMIT: int = Field(default=3)
    FRONTEND_URL: str = Field(default="http://localhost:5173")

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
