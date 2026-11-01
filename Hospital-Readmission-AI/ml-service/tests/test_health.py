from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_up():
    response = client.get("/ml/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "UP"
    assert body["service"] == "ml-service"


def test_predict_not_implemented_yet():
    response = client.post("/ml/predict", json={"admission_id": 1})
    assert response.status_code == 501
