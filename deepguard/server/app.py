from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import asynccontextmanager, closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "data" / "deepguard.db"

Decision = Literal["genuine", "fake", "review"]
ReviewStatus = Literal["pending", "cleared", "escalated"]


class ChallengeResult(BaseModel):
    key: str = Field(min_length=1, max_length=40)
    label: str = Field(min_length=1, max_length=80)
    passed: bool
    peak: float = Field(ge=0, le=1)


class SessionCreate(BaseModel):
    source: Literal["camera", "upload"] = "camera"
    decision: Decision
    deepfake_probability: float = Field(ge=0, le=1)
    liveness_score: float = Field(ge=0, le=1)
    quality_score: float = Field(ge=0, le=1)
    latency_ms: int = Field(ge=0, le=300_000)
    runtime: str = Field(default="browser-wasm", min_length=1, max_length=80)
    model_version: str = Field(default="deep-fake-detector-v2-q8", max_length=120)
    challenges: list[ChallengeResult] = Field(default_factory=list, max_length=12)
    notes: str = Field(default="", max_length=500)


class ReviewUpdate(BaseModel):
    review_status: ReviewStatus


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect(db_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect(db_path)) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS verification_sessions (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                source TEXT NOT NULL,
                decision TEXT NOT NULL,
                deepfake_probability REAL NOT NULL,
                liveness_score REAL NOT NULL,
                quality_score REAL NOT NULL,
                latency_ms INTEGER NOT NULL,
                runtime TEXT NOT NULL,
                model_version TEXT NOT NULL,
                challenges_json TEXT NOT NULL,
                notes TEXT NOT NULL,
                review_status TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON verification_sessions(created_at DESC)"
        )
        connection.commit()


def serialize_row(row: sqlite3.Row) -> dict:
    result = dict(row)
    result["challenges"] = json.loads(result.pop("challenges_json"))
    return result


def create_app(db_path: Path | None = None, serve_client: bool = True) -> FastAPI:
    selected_db = db_path or Path(os.environ.get("DEEPGUARD_DB", DEFAULT_DB))

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        initialize_database(selected_db)
        yield

    app = FastAPI(
        title="DeepGuard API",
        version="0.1.0",
        description="Local session service for Deepfake Detection and Liveness Detection.",
        lifespan=lifespan,
    )
    app.state.db_path = selected_db
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict:
        return {
            "status": "ready",
            "service": "deepguard-local-api",
            "storage": "sqlite",
            "version": app.version,
        }

    @app.post("/api/sessions", status_code=201)
    def create_session(payload: SessionCreate) -> dict:
        created_at = utc_now()
        session_id = f"DG-{datetime.now(timezone.utc):%y%m%d}-{uuid.uuid4().hex[:6].upper()}"
        review_status: ReviewStatus = "pending" if payload.decision == "review" else "cleared"
        with closing(connect(selected_db)) as connection:
            connection.execute(
                """
                INSERT INTO verification_sessions (
                    id, created_at, source, decision, deepfake_probability,
                    liveness_score, quality_score, latency_ms, runtime,
                    model_version, challenges_json, notes, review_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    created_at,
                    payload.source,
                    payload.decision,
                    payload.deepfake_probability,
                    payload.liveness_score,
                    payload.quality_score,
                    payload.latency_ms,
                    payload.runtime,
                    payload.model_version,
                    json.dumps([item.model_dump() for item in payload.challenges]),
                    payload.notes,
                    review_status,
                ),
            )
            connection.commit()
            row = connection.execute(
                "SELECT * FROM verification_sessions WHERE id = ?", (session_id,)
            ).fetchone()
        return serialize_row(row)

    @app.get("/api/sessions")
    def list_sessions(
        limit: int = Query(default=100, ge=1, le=250),
        decision: Decision | None = None,
    ) -> list[dict]:
        query = "SELECT * FROM verification_sessions"
        params: list[object] = []
        if decision:
            query += " WHERE decision = ?"
            params.append(decision)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        with closing(connect(selected_db)) as connection:
            rows = connection.execute(query, params).fetchall()
        return [serialize_row(row) for row in rows]

    @app.patch("/api/sessions/{session_id}/review")
    def update_review(session_id: str, payload: ReviewUpdate) -> dict:
        with closing(connect(selected_db)) as connection:
            cursor = connection.execute(
                "UPDATE verification_sessions SET review_status = ? WHERE id = ?",
                (payload.review_status, session_id),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Session not found")
            connection.commit()
            row = connection.execute(
                "SELECT * FROM verification_sessions WHERE id = ?", (session_id,)
            ).fetchone()
        return serialize_row(row)

    @app.get("/api/metrics")
    def metrics() -> dict:
        since = (datetime.now(timezone.utc) - timedelta(days=6)).date()
        with closing(connect(selected_db)) as connection:
            summary = connection.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    COALESCE(SUM(CASE WHEN decision = 'genuine' THEN 1 ELSE 0 END), 0) AS genuine,
                    COALESCE(SUM(CASE WHEN decision = 'fake' THEN 1 ELSE 0 END), 0) AS fake,
                    COALESCE(SUM(CASE WHEN decision = 'review' THEN 1 ELSE 0 END), 0) AS review,
                    COALESCE(AVG(latency_ms), 0) AS avg_latency_ms,
                    COALESCE(AVG(liveness_score), 0) AS avg_liveness
                FROM verification_sessions
                """
            ).fetchone()
            daily_rows = connection.execute(
                """
                SELECT substr(created_at, 1, 10) AS day,
                       COUNT(*) AS total,
                       SUM(CASE WHEN decision = 'fake' THEN 1 ELSE 0 END) AS flagged
                FROM verification_sessions
                WHERE date(created_at) >= date(?)
                GROUP BY substr(created_at, 1, 10)
                ORDER BY day
                """,
                (since.isoformat(),),
            ).fetchall()

        daily_map = {row["day"]: dict(row) for row in daily_rows}
        daily = []
        for offset in range(7):
            day = since + timedelta(days=offset)
            values = daily_map.get(day.isoformat(), {"total": 0, "flagged": 0})
            daily.append(
                {"day": day.isoformat(), "total": values["total"], "flagged": values["flagged"]}
            )
        return {**dict(summary), "daily": daily}

    client_dist = ROOT / "dist"
    if serve_client and client_dist.exists():
        app.mount("/", StaticFiles(directory=client_dist, html=True), name="client")

    return app


app = create_app()
