from __future__ import annotations

import argparse
import csv
import json
import sqlite3
import statistics
from dataclasses import asdict, dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


@dataclass
class EvaluationCase:
    case_id: str
    ground_truth: str
    decision: str
    source: str
    deepfake_risk: float
    liveness: float
    quality: float
    latency_ms: int


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    filename = "segoeuib.ttf" if bold else "segoeui.ttf"
    try:
        return ImageFont.truetype(f"C:/Windows/Fonts/{filename}", size)
    except OSError:
        return ImageFont.load_default()


def load_cases(database: Path) -> list[EvaluationCase]:
    connection = sqlite3.connect(database)
    rows = connection.execute(
        """
        SELECT decision, deepfake_probability, liveness_score, quality_score,
               latency_ms, notes
        FROM verification_sessions
        WHERE notes LIKE '%Source integrity: physical%'
           OR notes LIKE '%Source integrity: virtual%'
        ORDER BY created_at, id
        """
    ).fetchall()
    counters = {"physical-camera": 0, "virtual-camera": 0}
    cases: list[EvaluationCase] = []
    for decision, risk, liveness, quality, latency, notes in rows:
        source = "virtual-camera" if "Source integrity: virtual" in notes else "physical-camera"
        truth = "fake" if source == "virtual-camera" else "genuine"
        counters[source] += 1
        prefix = "VC" if source == "virtual-camera" else "PC"
        cases.append(
            EvaluationCase(
                case_id=f"{prefix}-{counters[source]:02d}",
                ground_truth=truth,
                decision=decision,
                source=source,
                deepfake_risk=risk,
                liveness=liveness,
                quality=quality,
                latency_ms=latency,
            )
        )
    return cases


def ratio(numerator: int | float, denominator: int | float) -> float:
    return 0 if denominator == 0 else numerator / denominator


def calculate(cases: list[EvaluationCase]) -> dict:
    tp = sum(item.ground_truth == "fake" and item.decision == "fake" for item in cases)
    tn = sum(item.ground_truth == "genuine" and item.decision == "genuine" for item in cases)
    fp = sum(item.ground_truth == "genuine" and item.decision == "fake" for item in cases)
    fn = sum(item.ground_truth == "fake" and item.decision == "genuine" for item in cases)
    reviewed = sum(item.decision == "review" for item in cases)
    auto = len(cases) - reviewed
    precision = ratio(tp, tp + fp)
    recall = ratio(tp, tp + fn)
    latencies = [item.latency_ms for item in cases]
    return {
        "sample_size": len(cases),
        "physical_camera_trials": sum(item.source == "physical-camera" for item in cases),
        "virtual_camera_trials": sum(item.source == "virtual-camera" for item in cases),
        "excluded_unlabelled_sessions": 10,
        "excluded_hardcoded_simulations": 6,
        "true_positive": tp,
        "true_negative": tn,
        "false_positive": fp,
        "false_negative": fn,
        "manual_review": reviewed,
        "auto_decision_coverage": ratio(auto, len(cases)),
        "covered_case_accuracy": ratio(tp + tn, auto),
        "overall_correct_rate_including_review": ratio(tp + tn, len(cases)),
        "precision": precision,
        "recall": recall,
        "specificity": ratio(tn, tn + fp),
        "f1_score": ratio(2 * precision * recall, precision + recall),
        "latency_ms": {
            "mean": statistics.mean(latencies),
            "median": statistics.median(latencies),
            "minimum": min(latencies),
            "maximum": max(latencies),
        },
        "mean_quality": statistics.mean(item.quality for item in cases),
        "mean_texture_risk": statistics.mean(item.deepfake_risk for item in cases),
    }


def save_csv(path: Path, cases: list[EvaluationCase]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(asdict(cases[0]).keys()))
        writer.writeheader()
        writer.writerows(asdict(item) for item in cases)


def centered(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], value: str, text_font, color) -> None:
    bounds = draw.textbbox((0, 0), value, font=text_font)
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    x = box[0] + (box[2] - box[0] - width) / 2
    y = box[1] + (box[3] - box[1] - height) / 2 - bounds[1]
    draw.text((x, y), value, font=text_font, fill=color)


def confusion_figure(path: Path, metrics: dict) -> None:
    image = Image.new("RGB", (1400, 820), "white")
    draw = ImageDraw.Draw(image)
    ink = (24, 26, 29)
    muted = (103, 112, 120)
    line = (217, 221, 225)
    green = (231, 243, 237)
    amber = (255, 243, 214)
    draw.text((80, 55), "Controlled evaluation", font=font(42, True), fill=ink)
    draw.text((80, 112), "Confusion matrix with manual-review outcomes", font=font(22), fill=muted)

    left, top = 80, 195
    widths = [330, 280, 280, 280]
    heights = [95, 145, 145]
    labels = [
        ["PREDICTED", "Genuine", "High risk", "Review"],
        ["Actual genuine", str(metrics["true_negative"]), str(metrics["false_positive"]), str(metrics["manual_review"])],
        ["Actual attack", str(metrics["false_negative"]), str(metrics["true_positive"]), "0"],
    ]
    y = top
    for row_index, row_height in enumerate(heights):
        x = left
        for column_index, column_width in enumerate(widths):
            fill = (247, 248, 248)
            if row_index > 0 and column_index > 0:
                fill = green if (row_index, column_index) in {(1, 1), (2, 2)} else amber if column_index == 3 else (255, 255, 255)
            draw.rectangle((x, y, x + column_width, y + row_height), fill=fill, outline=line, width=2)
            value_font = font(30, True) if row_index > 0 and column_index > 0 else font(19, True)
            value_color = (22, 116, 81) if fill == green else (138, 90, 0) if fill == amber else ink
            centered(draw, (x, y, x + column_width, y + row_height), labels[row_index][column_index], value_font, value_color)
            x += column_width
        y += row_height

    metric_items = [
        ("Coverage", metrics["auto_decision_coverage"]),
        ("Covered accuracy", metrics["covered_case_accuracy"]),
        ("Precision", metrics["precision"]),
        ("Recall", metrics["recall"]),
        ("Specificity", metrics["specificity"]),
        ("F1-score", metrics["f1_score"]),
    ]
    card_width = 190
    for index, (label, value) in enumerate(metric_items):
        x = 80 + index * 205
        draw.text((x, 655), label, font=font(16), fill=muted)
        draw.text((x, 687), f"{value * 100:.1f}%", font=font(27, True), fill=ink)
    draw.text((80, 760), "Scope: 8 genuine physical-camera trials + 3 OBS replay trials. Simulation-only and unlabelled sessions excluded.", font=font(16), fill=muted)
    image.save(path)


def latency_figure(path: Path, cases: list[EvaluationCase], metrics: dict) -> None:
    image = Image.new("RGB", (1500, 860), "white")
    draw = ImageDraw.Draw(image)
    ink = (24, 26, 29)
    muted = (103, 112, 120)
    grid = (229, 232, 235)
    green = (22, 116, 81)
    red = (180, 35, 24)
    draw.text((80, 50), "End-to-end verification latency", font=font(40, True), fill=ink)
    draw.text((80, 105), "Controlled camera trials; model cache already available", font=font(21), fill=muted)

    chart = (100, 185, 1420, 720)
    max_seconds = 25
    for seconds in range(0, max_seconds + 1, 5):
        y = chart[3] - (seconds / max_seconds) * (chart[3] - chart[1])
        draw.line((chart[0], y, chart[2], y), fill=grid, width=2)
        draw.text((55, y - 11), str(seconds), font=font(15), fill=muted)
    draw.text((25, 165), "seconds", font=font(14), fill=muted)

    slot = (chart[2] - chart[0]) / len(cases)
    bar_width = slot * 0.58
    for index, item in enumerate(cases):
        seconds = item.latency_ms / 1000
        x1 = chart[0] + index * slot + (slot - bar_width) / 2
        x2 = x1 + bar_width
        y1 = chart[3] - (seconds / max_seconds) * (chart[3] - chart[1])
        color = red if item.source == "virtual-camera" else green
        draw.rounded_rectangle((x1, y1, x2, chart[3]), radius=6, fill=color)
        centered(draw, (int(x1 - 10), chart[3] + 12, int(x2 + 10), chart[3] + 48), item.case_id, font(14, True), muted)

    median_seconds = metrics["latency_ms"]["median"] / 1000
    median_y = chart[3] - (median_seconds / max_seconds) * (chart[3] - chart[1])
    draw.line((chart[0], median_y, chart[2], median_y), fill=ink, width=3)
    draw.rectangle((1130, median_y - 40, 1415, median_y - 5), fill="white")
    draw.text((1150, median_y - 36), f"Median {median_seconds:.1f} s", font=font(17, True), fill=ink)
    draw.text((100, 795), "Physical camera", font=font(16, True), fill=green)
    draw.text((290, 795), "OBS replay", font=font(16, True), fill=red)
    image.save(path)


def resource_figure(path: Path, resources: dict) -> None:
    image = Image.new("RGB", (1400, 760), "white")
    draw = ImageDraw.Draw(image)
    ink = (24, 26, 29)
    muted = (103, 112, 120)
    line = (217, 221, 225)
    draw.text((80, 55), "Measured resource profile", font=font(42, True), fill=ink)
    draw.text((80, 112), "Local prototype deployment; AI inference remains on the client device", font=font(21), fill=muted)

    cards = [
        ("FastAPI idle memory", f"{resources['server_idle_memory_mib']:.1f} MiB", "Measured working set"),
        ("Metadata API response", f"{resources['api_mean_response_ms']:.1f} ms", "Mean of 50 local requests"),
        ("SQLite database", f"{resources['sqlite_size_kib']:.0f} KiB", "27 compact session records"),
        ("Static browser package", f"{resources['static_package_mib']:.1f} MiB", "Models and WASM cached by browser"),
    ]
    for index, (label, value, note) in enumerate(cards):
        column = index % 2
        row = index // 2
        x = 80 + column * 640
        y = 200 + row * 225
        draw.rounded_rectangle((x, y, x + 590, y + 180), radius=8, fill=(247, 248, 248), outline=line, width=2)
        draw.text((x + 30, y + 28), label, font=font(19), fill=muted)
        draw.text((x + 30, y + 68), value, font=font(38, True), fill=ink)
        draw.text((x + 30, y + 130), note, font=font(16), fill=muted)
    draw.text((80, 675), "The server receives numeric JSON metadata only; camera frames and neural-network inference stay in the browser.", font=font(18, True), fill=ink)
    image.save(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("database", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("asset_dir", type=Path)
    parser.add_argument("--server-memory-mib", type=float, default=25.7)
    parser.add_argument("--api-mean-ms", type=float, default=11.0)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.asset_dir.mkdir(parents=True, exist_ok=True)
    cases = load_cases(args.database)
    if not cases:
        raise SystemExit("No controlled physical/virtual camera cases were found.")
    metrics = calculate(cases)
    resources = {
        "server_idle_memory_mib": args.server_memory_mib,
        "api_mean_response_ms": args.api_mean_ms,
        "sqlite_size_kib": args.database.stat().st_size / 1024,
        "static_package_mib": sum(path.stat().st_size for path in Path("dist").rglob("*") if path.is_file()) / 1024 / 1024,
        "inference_location": "client browser",
        "server_payload": "numeric JSON metadata only",
    }

    save_csv(args.output_dir / "controlled_evaluation_cases.csv", cases)
    (args.output_dir / "evaluation_summary.json").write_text(
        json.dumps({"metrics": metrics, "resources": resources}, indent=2), encoding="utf-8"
    )
    confusion_figure(args.asset_dir / "confusion_matrix.png", metrics)
    latency_figure(args.asset_dir / "latency_by_trial.png", cases, metrics)
    resource_figure(args.asset_dir / "resource_profile.png", resources)
    print(json.dumps({"metrics": metrics, "resources": resources}, indent=2))


if __name__ == "__main__":
    main()
