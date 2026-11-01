from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    status: str
    service: str
    model_loaded: bool
    model_version: str
    timestamp: str
