# DeepGuard

DeepGuard is a local-first research prototype for deepfake detection and active facial liveness verification. Camera frames and AI inference stay in the browser; a small FastAPI service stores numeric session results and review decisions in SQLite.

## Workflow

1. The browser requests camera access and locates one face with MediaPipe Face Landmarker.
2. The user completes blink, head-turn, and smile challenges.
3. Three captured frames are scored by a quantized ONNX deepfake classifier through WebGPU, with browser WASM as the compatibility fallback.
4. Active liveness uses a fixed, clearly displayed challenge order and verifies neutral-to-action transitions. A blink requires open eyes, eye closure, and reopening. The head-motion guide keeps all five stages visible: center calibration, right turn, left turn, recentering, and a closer-or-farther depth change measured from the original face size.
5. The decision policy fuses source integrity, active liveness, face quality, and texture risk. Virtual-camera input or texture risk of 72% and above is High risk. A physical camera with strong liveness, good quality, and texture risk below 60% is Genuine. Uncertain and poor-quality samples go to Manual review.
6. FastAPI stores the scores, challenge results, runtime, and review state. It does not receive camera frames.

The **Evaluation** screen reports the labelled controlled trials, confusion matrix, decision coverage, latency, and measured local resource use. It deliberately separates `Manual review` from automatic `Genuine` and `High risk` decisions.

## Run

```powershell
.\run.ps1
```

Open `http://127.0.0.1:5173`. The first verification downloads the quantized classifier into the browser cache. Later runs reuse the cached model.

## Verify

```powershell
pnpm test
pnpm lint
pnpm build
.\.venv\Scripts\python.exe -m pytest server\test_app.py -q
```

Regenerate the evaluation CSV, JSON summary, and report figures from the labelled trial records with:

```powershell
.\.venv\Scripts\python.exe scripts\generate_evaluation_artifacts.py
```

The generated evidence is stored in `..\outputs\evaluation`, with figures in `..\work\evaluation_assets`.

## Scope

This is a graduation-project prototype, not a certified biometric product. Low-quality and borderline samples are sent to manual review. Production deployment requires evaluation on representative users, devices, lighting, spoof media, and demographic groups before thresholds are approved.
