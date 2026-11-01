"""Settings loaded from environment variables / ml-service/.env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", protected_namespaces=())

    ml_service_host: str = "0.0.0.0"
    ml_service_port: int = 8000
    model_path: str = "model/readmission_model.joblib"
    model_version: str = "0.0.0-untrained"
    allowed_origins: str = "http://localhost:8080,http://localhost:5173"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
