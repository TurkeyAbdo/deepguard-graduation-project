from pathlib import Path

from fastapi.testclient import TestClient

from server.app import create_app


def make_client(tmp_path: Path) -> TestClient:
    app = create_app(tmp_path / "test.db", serve_client=False)
    return TestClient(app)


def sample_payload(decision: str = "genuine") -> dict:
    return {
        "source": "camera",
        "decision": decision,
        "deepfake_probability": 0.18,
        "liveness_score": 0.93,
        "quality_score": 0.88,
        "latency_ms": 742,
        "runtime": "webgpu-q4f16",
        "model_version": "deep-fake-detector-v2",
        "challenges": [{"key": "blink", "label": "Blink", "passed": True, "peak": 0.91}],
    }


def test_health(tmp_path: Path) -> None:
    with make_client(tmp_path) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ready"


def test_empty_metrics_are_numeric_zeroes(tmp_path: Path) -> None:
    with make_client(tmp_path) as client:
        metrics = client.get("/api/metrics").json()
        assert metrics["total"] == 0
        assert metrics["genuine"] == 0
        assert metrics["fake"] == 0
        assert metrics["review"] == 0


def test_session_round_trip_and_metrics(tmp_path: Path) -> None:
    with make_client(tmp_path) as client:
        created = client.post("/api/sessions", json=sample_payload())
        assert created.status_code == 201
        assert created.json()["id"].startswith("DG-")

        sessions = client.get("/api/sessions").json()
        assert len(sessions) == 1
        assert sessions[0]["challenges"][0]["passed"] is True

        metrics = client.get("/api/metrics").json()
        assert metrics["total"] == 1
        assert metrics["genuine"] == 1
        assert len(metrics["daily"]) == 7


def test_review_status_can_be_updated(tmp_path: Path) -> None:
    with make_client(tmp_path) as client:
        session = client.post("/api/sessions", json=sample_payload("review")).json()
        response = client.patch(
            f"/api/sessions/{session['id']}/review", json={"review_status": "escalated"}
        )
        assert response.status_code == 200
        assert response.json()["review_status"] == "escalated"
